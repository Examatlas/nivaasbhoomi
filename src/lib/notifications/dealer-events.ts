import { connectDB } from "@/lib/db/connect";
import { WhatsAppSendLog } from "@/lib/db/models/WhatsAppSendLog";
import { sendBusinessTemplate } from "@/lib/whatsapp/send";
import { recordWhatsAppSend } from "@/lib/whatsapp/provider";
import { normalizeIndianMobile } from "@/lib/auth/otp-login";
import { dealerNotificationsEnabled } from "@/lib/config/flags";

/**
 * Dealer lifecycle WhatsApp notifications (Phase 1) — the ONE place all three
 * event-driven dealer notifications go through. Admin actions call `notifyDealer`
 * (via `after()`, so it runs AFTER the response and never blocks the admin UI).
 *
 * Guarantees:
 *   - best-effort: never throws, so an admin action is never rolled back by a
 *     send failure; failures are logged to WhatsAppSendLog (delivered:false);
 *   - multi-variable → always Meta transport (Zenith only takes OTP-shape params,
 *     see provider.isZenithEligible — untouched);
 *   - Utility category → sent immediately (no 9am–8pm window);
 *   - dedup: one delivered notification per (event + entityId) per 24h;
 *   - missing/invalid dealer phone → skip + log, silently.
 */

export type DealerNotifyEvent =
  | "dealer_approved"
  | "listing_approved"
  | "listing_rejected"
  | "listing_updated";

const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface NotifyDealerInput {
  event: DealerNotifyEvent;
  dealerId: string;
  dealerName?: string | null;
  dealerPhone?: string | null;
  /** Subject id: listingId for listing_*, dealerId for dealer_approved. */
  entityId: string;
  listingTitle?: string | null;
  listingSlug?: string | null;
  reason?: string | null; // listing_rejected only
  changeSummary?: string | null; // listing_updated only
}

/**
 * Make a value safe for a Meta template parameter: no newlines/tabs (Meta
 * rejects them), collapse runs of whitespace, trim, and cap the length. When it
 * exceeds `max`, truncate cleanly at a WORD boundary and append an ellipsis
 * (never cut a word mid-way). Used for every param, and especially the
 * admin-supplied rejection reason (stored in full in the DB; only the WhatsApp
 * copy is truncated).
 */
export function sanitizeTemplateParam(value: string | null | undefined, max = 200): string {
  const clean = (value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (clean.length <= max) return clean;
  const ELLIPSIS = "…";
  const cut = clean.slice(0, max - ELLIPSIS.length);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return base.trimEnd() + ELLIPSIS;
}

/** True if this (event, entityId) already has a DELIVERED notification in 24h.
 *  A prior FAILED send does not block a retry on the next trigger. */
async function alreadyNotified(event: DealerNotifyEvent, entityId: string): Promise<boolean> {
  const since = new Date(Date.now() - DEDUP_WINDOW_MS);
  const existing = await WhatsAppSendLog.findOne(
    { entityId, event, delivered: true, createdAt: { $gte: since } },
    { _id: 1 },
  ).lean();
  return Boolean(existing);
}

/** Build the typed template params for an event (all values sanitized). */
function buildSend(input: NotifyDealerInput):
  | { template: "dealer_approved"; params: { dealerName: string } }
  | { template: "listing_approved"; params: { dealerName: string; listingTitle: string; listingSlug: string } }
  | { template: "listing_rejected"; params: { dealerName: string; listingTitle: string; reason: string } }
  | { template: "listing_updated"; params: { dealerName: string; listingTitle: string; changeSummary: string } } {
  const dealerName = sanitizeTemplateParam(input.dealerName, 60) || "there";
  switch (input.event) {
    case "dealer_approved":
      return { template: "dealer_approved", params: { dealerName } };
    case "listing_approved":
      return {
        template: "listing_approved",
        params: {
          dealerName,
          listingTitle: sanitizeTemplateParam(input.listingTitle, 100) || "your listing",
          // slug is URL-safe already; keep it intact (no space-collapsing needed).
          listingSlug: (input.listingSlug ?? "").trim().slice(0, 200),
        },
      };
    case "listing_rejected":
      return {
        template: "listing_rejected",
        params: {
          dealerName,
          listingTitle: sanitizeTemplateParam(input.listingTitle, 100) || "your listing",
          reason: sanitizeTemplateParam(input.reason, 200) || "Please review and resubmit.",
        },
      };
    case "listing_updated":
      return {
        template: "listing_updated",
        params: {
          dealerName,
          listingTitle: sanitizeTemplateParam(input.listingTitle, 100) || "your listing",
          changeSummary: sanitizeTemplateParam(input.changeSummary, 200) || "Details were updated.",
        },
      };
  }
}

/**
 * Send one dealer lifecycle notification. Fire-and-forget friendly: it awaits
 * internally but swallows every error, so callers can `after(() => notifyDealer(…))`
 * without a try/catch.
 */
export async function notifyDealer(input: NotifyDealerInput): Promise<void> {
  try {
    if (!dealerNotificationsEnabled()) return;

    const phone = normalizeIndianMobile(input.dealerPhone ?? "");
    if (!phone) {
      // Missing/invalid phone → skip, but leave a trail for the admin indicator.
      await recordWhatsAppSend({
        provider: "meta",
        template: input.event,
        delivered: false,
        error: "dealer phone missing or invalid",
        dealerId: input.dealerId,
        event: input.event,
        entityId: input.entityId,
      });
      return;
    }

    await connectDB();
    if (await alreadyNotified(input.event, input.entityId)) return; // 24h dedup

    const { template, params } = buildSend(input);
    // sendBusinessTemplate routes via Zenith (multi-variable) when
    // WHATSAPP_PROVIDER=zenith, with an automatic Meta fallback on 5xx/timeout.
    const res = await sendBusinessTemplate(phone, template, params);

    await recordWhatsAppSend({
      // The ACTUAL transport used (zenith / meta / meta_fallback), not a guess.
      provider: res.via,
      template: input.event,
      delivered: res.delivered,
      error: res.error,
      messageId: res.messageId,
      fellBack: res.fellBack,
      dealerId: input.dealerId,
      event: input.event,
      entityId: input.entityId,
    });
  } catch {
    // Best-effort: a notification must NEVER break the admin action that queued it.
  }
}

export interface LastNotification {
  event: string;
  delivered: boolean;
  error?: string | null;
  createdAt: string;
}

/** Latest notification row for an entity (listing or dealer) — admin indicator. */
export async function getLastDealerNotification(entityId: string): Promise<LastNotification | null> {
  try {
    await connectDB();
    const row = await WhatsAppSendLog.findOne(
      { entityId, event: { $exists: true } },
      { event: 1, delivered: 1, error: 1, createdAt: 1 },
    )
      .sort({ createdAt: -1 })
      .lean();
    if (!row) return null;
    return {
      event: String(row.event),
      delivered: Boolean(row.delivered),
      error: row.error ?? null,
      createdAt: new Date(row.createdAt as Date).toISOString(),
    };
  } catch {
    return null;
  }
}
