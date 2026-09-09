import { connectDB } from "@/lib/db/connect";
import { Conversation } from "@/lib/db/models/Conversation";
import { sendBusinessText } from "@/lib/whatsapp/send";
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
} from "@/lib/whatsapp/n8n";
import { upsertLead } from "@/lib/leads/upsert";
import { routeLead } from "@/lib/leads/routing";

/**
 * Inbound WhatsApp message processing (DEV-SPEC.txt Section 11, steps a-i).
 *
 * Runs AFTER the webhook has already returned 200 (via `after`), so it may take
 * its time. It NEVER throws - every external failure becomes a value or a queued
 * retry, so one bad message can't wedge the pipeline.
 *
 * A qualified lead is saved with its extracted fields, then routed to exactly
 * one dealer via the Section 12 engine (step i). Routing is atomic + idempotent,
 * so re-processing a message never double-assigns or double-counts quota.
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
  /** Routing outcome, present when a qualified lead was routed (Section 12). */
  routing?: {
    decision: string;
    reason: string;
    dealerId?: string;
    assignedNow?: boolean;
  };
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
    // Routes via Zenith's free-form endpoint when WHATSAPP_PROVIDER=zenith,
    // falling back to Meta on a Zenith 5xx/timeout.
    const sent = await sendBusinessText(evt.from, ai.reply);
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

    // (i) Routing (Section 12): a qualified, still-unassigned lead is routed to
    //     exactly one dealer. routeLead is atomic + idempotent - re-processing
    //     the same message can never double-assign or double-count quota, and an
    //     already-assigned lead is left untouched (exclusivity).
    let routing: ProcessResult["routing"];
    if (leadId && ai.isQualified) {
      const r = await routeLead(leadId);
      routing = {
        decision: r.decision,
        reason: r.reason,
        dealerId: r.dealerId,
        assignedNow: r.assignedNow,
      };
    }

    return {
      status: "processed",
      listingId,
      reply: ai.reply,
      replyDelivered: sent.delivered,
      leadId: leadId ?? undefined,
      isQualified: Boolean(ai.isQualified),
      qualificationScore: ai.qualificationScore,
      routing,
    };
  } catch (err) {
    // Absolute backstop: never throw from the webhook pipeline.
    return {
      status: "empty",
      note: err instanceof Error ? err.message : "unexpected processing error",
    };
  }
}
