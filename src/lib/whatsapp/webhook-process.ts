import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Conversation } from "@/lib/db/models/Conversation";
import { Lead } from "@/lib/db/models/Lead";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";
import { sendText } from "@/lib/whatsapp/client";
import {
  parseListingRef,
  buildListingContext,
  conversationHistory,
  findExistingLead,
} from "@/lib/leads/context";
import {
  forwardToN8n,
  enqueueN8nRetry,
  n8nConfigured,
  type N8nRequest,
  type N8nResponse,
  type N8nExtracted,
} from "@/lib/whatsapp/n8n";

/**
 * Inbound WhatsApp message processing (DEV-SPEC.txt Section 11, steps a-i).
 *
 * Runs AFTER the webhook has already returned 200 (via `after`), so it may take
 * its time. It NEVER throws - every external failure becomes a value or a queued
 * retry, so one bad message can't wedge the pipeline.
 *
 * IMPORTANT (this phase): a qualified lead is SAVED with its extracted fields
 * and isQualified flag, but is NOT assigned to a dealer. Routing is the next
 * session - see the ROUTING TODO below.
 */

const WINDOW_MS = 24 * 60 * 60 * 1000;

export interface InboundEvent {
  from: string; // buyer phone (E.164 digits, no +)
  messageId: string;
  text: string;
  profileName?: string;
}

export interface ProcessResult {
  status: "processed" | "duplicate" | "n8n_unconfigured" | "n8n_failed" | "empty";
  listingId?: string | null;
  reply?: string;
  replyDelivered?: boolean;
  leadId?: string;
  isQualified?: boolean;
  qualificationScore?: number;
  note?: string;
}

export interface ProcessOptions {
  /**
   * DEV-ONLY: a canned n8n response supplied by the dev simulator so the whole
   * reply/lead path can be exercised without a live n8n. The real webhook never
   * passes this - production always calls the configured n8n.
   */
  aiOverride?: N8nResponse;
}

export async function processInboundMessage(
  evt: InboundEvent,
  opts: ProcessOptions = {},
): Promise<ProcessResult> {
  try {
    if (!evt.from || !evt.messageId) return { status: "empty" };
    await connectDB();

    // Idempotency: Meta redelivers on timeout. Skip a message we've already
    // logged for this phone.
    const already = await Conversation.findOne(
      { phone: evt.from, "messages.waMessageId": evt.messageId },
      { _id: 1 },
    ).lean();
    if (already) return { status: "duplicate", note: "message already processed" };

    const listingId = parseListingRef(evt.text);
    const now = new Date();

    // (b,c) Upsert conversation, append inbound message, refresh the 24h window.
    const conv = await Conversation.findOneAndUpdate(
      { phone: evt.from },
      {
        $push: {
          messages: {
            direction: "in",
            type: "text",
            body: evt.text,
            waMessageId: evt.messageId,
            timestamp: now,
          },
        },
        $set: { lastMessageAt: now, windowExpiresAt: new Date(now.getTime() + WINDOW_MS) },
      },
      { upsert: true, new: true },
    );

    // (e) Build the n8n payload.
    const [listingContext, existingLead] = await Promise.all([
      buildListingContext(listingId),
      findExistingLead(evt.from),
    ]);
    const payload: N8nRequest = {
      phone: evt.from,
      profileName: evt.profileName,
      message: evt.text,
      messageId: evt.messageId,
      listingId,
      listingContext,
      conversationHistory: conversationHistory(conv),
      existingLead,
    };

    // (f) Get the AI result. The dev simulator can inject a canned response;
    //     otherwise forward to n8n, queueing a retry on any failure.
    let ai: N8nResponse;
    if (opts.aiOverride) {
      ai = opts.aiOverride;
    } else if (!n8nConfigured()) {
      return {
        status: "n8n_unconfigured",
        listingId,
        note: "N8N_WEBHOOK_URL not set - inbound logged, no AI reply/lead produced.",
      };
    } else {
      try {
        ai = await forwardToN8n(payload);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "n8n call failed";
        await enqueueN8nRetry(payload, msg);
        return { status: "n8n_failed", listingId, note: msg };
      }
    }

    // (g) Send the reply (free-form: we're inside the 24h window) and log it.
    const sent = await sendText(evt.from, ai.reply);
    await Conversation.updateOne(
      { phone: evt.from },
      {
        $push: {
          messages: {
            direction: "out",
            type: "text",
            body: ai.reply,
            waMessageId: sent.messageId,
            timestamp: new Date(),
          },
        },
      },
    );

    // (h) Upsert the lead with the extracted fields + score. NOT assigned.
    const leadId = await upsertLead({
      phone: evt.from,
      profileName: evt.profileName,
      listingId,
      convLeadId: conv.leadId ? String(conv.leadId) : null,
      extracted: ai.extracted ?? {},
      qualificationScore: ai.qualificationScore,
      isQualified: Boolean(ai.isQualified),
      stage: ai.stage,
    });

    // Link the conversation to its lead.
    if (leadId && String(conv.leadId ?? "") !== leadId) {
      await Conversation.updateOne({ phone: evt.from }, { $set: { leadId } });
    }

    // (i) ROUTING TODO (Phase 5 - NEXT session): when
    //     `ai.isQualified === true` and the lead has no assignedDealerId, run
    //     the Section 12 routing engine here to assign an exclusive dealer and
    //     fire the `lead_assigned` template. Deliberately NOT done in this
    //     session - the lead is saved with isQualified set, unassigned.

    return {
      status: "processed",
      listingId,
      reply: ai.reply,
      replyDelivered: sent.delivered,
      leadId: leadId ?? undefined,
      isQualified: Boolean(ai.isQualified),
      qualificationScore: ai.qualificationScore,
    };
  } catch (err) {
    // Absolute backstop: never throw from the webhook pipeline.
    return {
      status: "empty",
      note: err instanceof Error ? err.message : "unexpected processing error",
    };
  }
}

interface UpsertLeadArgs {
  phone: string;
  profileName?: string;
  listingId: string | null;
  convLeadId: string | null;
  extracted: N8nExtracted;
  qualificationScore?: number;
  isQualified: boolean;
  stage?: "greeting" | "qualifying" | "qualified" | "closing";
}

async function upsertLead(args: UpsertLeadArgs): Promise<string | null> {
  const { cityId, localityId } = await resolveLocationIds(
    args.extracted.cityName,
    args.extracted.localityName,
  );

  // Only set fields the AI actually provided, so a later message can't blank an
  // earlier extraction.
  const set: Record<string, unknown> = {
    waProfileName: args.profileName,
    isQualified: args.isQualified,
  };
  const e = args.extracted;
  if (e.name) set.name = e.name;
  if (e.purpose) set.purpose = e.purpose;
  if (e.propertyType) set.propertyType = e.propertyType;
  if (e.bhk) set.bhk = e.bhk;
  if (typeof e.budgetMin === "number") set.budgetMin = e.budgetMin;
  if (typeof e.budgetMax === "number") set.budgetMax = e.budgetMax;
  if (e.timeline) set.timeline = e.timeline;
  if (typeof e.loanRequired === "boolean") set.loanRequired = e.loanRequired;
  if (e.siteVisitSlot) set.siteVisitSlot = e.siteVisitSlot;
  if (typeof args.qualificationScore === "number")
    set.qualificationScore = args.qualificationScore;
  if (args.stage) set.stage = args.stage;
  if (cityId) set.cityId = cityId;
  if (localityId) set.localityId = localityId;
  if (args.listingId && mongoose.Types.ObjectId.isValid(args.listingId)) {
    set.listingId = new mongoose.Types.ObjectId(args.listingId);
  }

  // Find the lead to update: the conversation's linked lead, else the latest
  // open lead for this phone, else create a new one.
  let lead =
    args.convLeadId && mongoose.Types.ObjectId.isValid(args.convLeadId)
      ? await Lead.findById(args.convLeadId)
      : null;
  if (!lead) {
    lead = await Lead.findOne({ phone: args.phone, status: { $nin: ["converted", "lost"] } })
      .sort({ createdAt: -1 })
      .exec();
  }

  if (lead) {
    lead.set(set);
    await lead.save();
    return String(lead._id);
  }

  const created = await Lead.create({
    phone: args.phone,
    source: args.listingId ? "listing" : "generic",
    status: "new",
    // NOTE: assignedDealerId intentionally unset - routing is the next session.
    ...set,
  });
  return String(created._id);
}

/** Best-effort resolve of AI city/locality NAMES to ids (null when unknown). */
async function resolveLocationIds(
  cityName?: string,
  localityName?: string,
): Promise<{ cityId?: mongoose.Types.ObjectId; localityId?: mongoose.Types.ObjectId }> {
  const out: { cityId?: mongoose.Types.ObjectId; localityId?: mongoose.Types.ObjectId } = {};
  if (cityName) {
    const city = await City.findOne(
      { name: new RegExp(`^${escapeRegex(cityName)}$`, "i") },
      { _id: 1 },
    ).lean();
    if (city) {
      out.cityId = city._id as mongoose.Types.ObjectId;
      if (localityName) {
        const loc = await Locality.findOne(
          { cityId: city._id, name: new RegExp(`^${escapeRegex(localityName)}$`, "i") },
          { _id: 1 },
        ).lean();
        if (loc) out.localityId = loc._id as mongoose.Types.ObjectId;
      }
    }
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
