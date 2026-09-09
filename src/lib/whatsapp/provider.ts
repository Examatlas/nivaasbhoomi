import { connectDB } from "@/lib/db/connect";
import { WhatsAppSendLog } from "@/lib/db/models/WhatsAppSendLog";

/**
 * WhatsApp transport provider selection, the Zenith→Meta fallback orchestration,
 * send logging, and the health aggregation. The public send interfaces
 * (sendOtpTemplate, sendBusinessTemplate) don't change — this is all internal.
 */
export type WaProvider = "zenith" | "meta";
export type SendProvider = "zenith" | "meta" | "meta_fallback";

/** Primary transport, from WHATSAPP_PROVIDER (default "meta"). */
export function whatsAppProvider(): WaProvider {
  return process.env.WHATSAPP_PROVIDER === "zenith" ? "zenith" : "meta";
}

/**
 * ⚠️ THE ONE DECISION PLACE — which templates may use Zenith.
 *
 * Zenith's /whatsapp/template endpoint accepts ONLY `code` + `customerName`, so
 * a template can go via Zenith only if its single variable is an OTP code.
 * `login_otp` qualifies. Every other template — property_alert (4 vars),
 * lead_assigned, listing_expiry_warning, review_request, site_visit_reminder,
 * followup_nudge, and any future dealer_rejected (reason) — has extra variables
 * and MUST go via Meta.
 */
export function isZenithEligible(templateName: string): boolean {
  const otpTemplate = process.env.ZENITHCODE_TEMPLATE_NAME ?? "login_otp";
  return templateName === otpTemplate || templateName === "login_otp";
}

export interface OtpAttempt {
  ok: boolean;
  status?: number; // HTTP status; undefined = network/timeout
  messageId?: string;
  error?: string;
}

/**
 * Zenith-primary, Meta-fallback OTP orchestration (pure + unit-tested).
 *   provider "meta"   → Meta only.
 *   provider "zenith" → try Zenith; delivered → done;
 *     - 4xx  → NO fallback (bad template/number fails on Meta too);
 *     - timeout / 5xx / network → fall back to Meta.
 */
export async function orchestrateOtpSend(opts: {
  provider: WaProvider;
  zenithReady: boolean;
  sendZenith: () => Promise<OtpAttempt>;
  sendMeta: () => Promise<OtpAttempt>;
  onFallback?: (reason: string) => void;
}): Promise<{ result: OtpAttempt; via: SendProvider; fellBack: boolean }> {
  const { provider, zenithReady, sendZenith, sendMeta, onFallback } = opts;

  if (provider === "zenith" && zenithReady) {
    const z = await sendZenith();
    if (z.ok) return { result: z, via: "zenith", fellBack: false };

    const is4xx = z.status != null && z.status >= 400 && z.status < 500;
    if (is4xx) return { result: z, via: "zenith", fellBack: false }; // deliberately no fallback

    onFallback?.(z.error ?? `status ${z.status ?? "network"}`);
    const m = await sendMeta();
    return { result: m, via: "meta_fallback", fellBack: true };
  }

  const m = await sendMeta();
  return { result: m, via: "meta", fellBack: false };
}

/**
 * Record a send: a structured console line (delivered=info, failed=warn, always
 * visible in Vercel logs) plus a best-effort DB row for the health dashboard.
 * Never throws, never blocks the login on a logging failure.
 */
export async function recordWhatsAppSend(entry: {
  provider: SendProvider;
  template: string;
  delivered: boolean;
  status?: number;
  messageId?: string;
  error?: string;
  fellBack?: boolean;
}): Promise<void> {
  const line = JSON.stringify({
    tag: "whatsapp_send",
    provider: entry.provider,
    template: entry.template,
    delivered: entry.delivered,
    status: entry.status,
    messageId: entry.messageId,
    error: entry.error,
    fellBack: Boolean(entry.fellBack),
  });
  if (entry.delivered) console.info("[whatsapp]", line);
  else console.warn("[whatsapp]", line);

  if (!process.env.MONGODB_URI) return; // no DB (e.g. unit tests) — skip cleanly
  try {
    await connectDB();
    await WhatsAppSendLog.create({
      provider: entry.provider,
      template: entry.template,
      delivered: entry.delivered,
      status: entry.status,
      messageId: entry.messageId,
      error: entry.error,
      fellBack: Boolean(entry.fellBack),
    });
  } catch {
    /* best-effort: analytics/logging must never break a send */
  }
}

export interface WhatsAppHealth {
  provider: WaProvider;
  zenithConfigured: boolean;
  windowHours: number;
  total: number;
  zenithSends: number; // delivered via Zenith
  fallbacks: number; // Zenith failed → Meta
  failures: number; // not delivered at all
}

/** Last-24h WhatsApp send health for the admin dashboard. */
export async function getWhatsAppHealth(): Promise<WhatsAppHealth> {
  const base: WhatsAppHealth = {
    provider: whatsAppProvider(),
    zenithConfigured: Boolean(process.env.ZENITHCODE_API_KEY),
    windowHours: 24,
    total: 0,
    zenithSends: 0,
    fallbacks: 0,
    failures: 0,
  };
  if (!process.env.MONGODB_URI) return base;
  try {
    await connectDB();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const logs = await WhatsAppSendLog.find(
      { createdAt: { $gte: since } },
      { provider: 1, delivered: 1, fellBack: 1 },
    ).lean();
    return {
      ...base,
      total: logs.length,
      zenithSends: logs.filter((l) => l.provider === "zenith" && l.delivered).length,
      fallbacks: logs.filter((l) => l.fellBack).length,
      failures: logs.filter((l) => !l.delivered).length,
    };
  } catch {
    return base;
  }
}
