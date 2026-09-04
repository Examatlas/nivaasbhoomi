import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Conversation } from "@/lib/db/models/Conversation";
import { upsertLead, parseListingRef, type ExtractedFields } from "@/lib/leads/upsert";
import { routeLead } from "@/lib/leads/routing";

/**
 * Ingest a QUALIFIED lead pushed by Zenith Code (Pattern 1). This is the second
 * half of the old webhook pipeline, reused verbatim: upsert the Conversation +
 * Lead, then run routeLead(). Routing/quota/exclusivity/notifications all stay
 * in NivaasBhoomi's DB and are unchanged.
 *
 * Idempotent: the same push twice must not double-create or double-assign. We
 * dedupe on an explicit eventId (when Zenith supplies one) AND, structurally, on
 * the phone -> single-open-lead mapping in upsertLead + the atomic claim in
 * routeLead (a second run sees the lead already assigned).
 */

const WINDOW_MS = 24 * 60 * 60 * 1000;

export interface IngestPayload {
  phone: string;
  profileName?: string;
  /** The buyer's message text, if provided - used to log + recover the Ref. */
  message?: string;
  /** The listing id from the [Ref: xxx] CTA tag (either field name accepted). */
  listingId?: string | null;
  listingRef?: string | null;
  extracted?: ExtractedFields;
  qualificationScore?: number;
  isQualified?: boolean;
  stage?: "greeting" | "qualifying" | "qualified" | "closing";
  /** Zenith's message/event id, for idempotency + conversation logging. */
  eventId?: string;
  messageId?: string;
}

export interface IngestResult {
  status: "processed" | "duplicate" | "empty";
  leadId?: string;
  listingId?: string | null;
  isQualified?: boolean;
  routing?: { decision: string; reason: string; dealerId?: string; assignedNow?: boolean };
  note?: string;
}

export async function ingestQualifiedLead(payload: IngestPayload): Promise<IngestResult> {
  const phone = (payload.phone ?? "").replace(/\D/g, "");
  if (!phone) return { status: "empty", note: "missing phone" };

  await connectDB();

  // Recover the listing id: explicit field, or parsed from the message text.
  const rawRef = payload.listingId ?? payload.listingRef ?? null;
  const listingId =
    rawRef && mongoose.Types.ObjectId.isValid(rawRef)
      ? rawRef
      : payload.message
        ? parseListingRef(payload.message)
        : null;

  const dedupeId = payload.eventId ?? payload.messageId;

  // Idempotency: skip if we've already logged this event for the phone.
  if (dedupeId) {
    const seen = await Conversation.findOne(
      { phone, "messages.waMessageId": dedupeId },
      { _id: 1 },
    ).lean();
    if (seen) return { status: "duplicate", note: "event already processed", listingId };
  }

  const now = new Date();

  // Upsert the conversation. Log the buyer message when present so the admin
  // conversation viewer still shows history even though Zenith runs the chat.
  const conv = await Conversation.findOneAndUpdate(
    { phone },
    {
      ...(payload.message
        ? {
            $push: {
              messages: {
                direction: "in",
                type: "text",
                body: payload.message,
                waMessageId: dedupeId,
                timestamp: now,
              },
            },
          }
        : {}),
      $set: { lastMessageAt: now, windowExpiresAt: new Date(now.getTime() + WINDOW_MS) },
    },
    { upsert: true, new: true },
  );

  const leadId = await upsertLead({
    phone,
    profileName: payload.profileName,
    listingId,
    convLeadId: conv.leadId ? String(conv.leadId) : null,
    extracted: payload.extracted ?? {},
    qualificationScore: payload.qualificationScore,
    isQualified: Boolean(payload.isQualified),
    stage: payload.stage,
  });

  if (leadId && String(conv.leadId ?? "") !== leadId) {
    await Conversation.updateOne({ phone }, { $set: { leadId } });
  }

  // Route only qualified leads (Section 12). routeLead is atomic + idempotent.
  let routing: IngestResult["routing"];
  if (leadId && payload.isQualified) {
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
    leadId: leadId ?? undefined,
    listingId,
    isQualified: Boolean(payload.isQualified),
    routing,
  };
}
