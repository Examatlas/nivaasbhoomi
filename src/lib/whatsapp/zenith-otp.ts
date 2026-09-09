/**
 * Zenith Code outbound adapter — CONFIRMED contract.
 *
 *   Template (approved, e.g. login_otp):
 *     POST https://app.zenithcode.io/api/v1/whatsapp/template
 *     Authorization: Bearer <ZENITHCODE_API_KEY>
 *     { to, template, language, code, customerName }
 *     - to: digits only + country code ("919288487841") — NEVER a "+".
 *     - code: OTP; Zenith puts it in the body AND the button itself.
 *     - language: template language ("en" for our login_otp) — env-configurable.
 *
 *   Free-form (only inside the 24h window):
 *     POST https://app.zenithcode.io/api/v1/whatsapp   { to, message, customerName }
 *
 * One credential (ZENITHCODE_API_KEY) — no Meta token / WABA id / phone id.
 * 8-second timeout so a hung Zenith can't block login; the caller then falls
 * back to Meta. Never throws.
 */
const ZENITH_BASE = "https://app.zenithcode.io/api/v1";
const TIMEOUT_MS = 8000;

export interface ZenithResult {
  ok: boolean;
  /** HTTP status; undefined on a network error or timeout. */
  status?: number;
  messageId?: string;
  error?: string;
  /** Full response body on failure (for logging). */
  bodyText?: string;
  timedOut?: boolean;
}

export function zenithConfigured(): boolean {
  return Boolean(process.env.ZENITHCODE_API_KEY);
}

/**
 * Zenith's template endpoint rejects an empty `customerName` with a 422
 * ("Too small: expected string to have >=1 characters"). At dealer/buyer login
 * the user record doesn't exist yet, so the name is blank — we substitute this
 * single fallback so the request is always valid. One constant, not scattered.
 */
export const DEFAULT_CUSTOMER_NAME = "Customer";

/** Trim a name; empty / whitespace-only → the fallback. Never returns "". */
export function sanitizeCustomerName(name?: string | null): string {
  const n = (name ?? "").trim();
  return n.length > 0 ? n : DEFAULT_CUSTOMER_NAME;
}

/** Defensive: strip everything but digits — a "+" must never reach Zenith. */
export function toDigits(phone: string): string {
  return (phone ?? "").replace(/\D/g, "");
}

/**
 * Guard a required Zenith field: trim, and if empty throw a CLEAR internal error
 * that names the field — so we never make a blind upstream call that 422s with
 * a cryptic message. The caller (otp-whatsapp) catches this and falls back to
 * Meta, so login still works.
 */
function requireField(field: string, value: string): string {
  const v = (value ?? "").trim();
  if (!v) throw new Error(`Zenith request is missing required field "${field}".`);
  return v;
}

async function zenithPost(path: string, body: Record<string, unknown>): Promise<ZenithResult> {
  const apiKey = process.env.ZENITHCODE_API_KEY;
  if (!apiKey) return { ok: false, error: "ZENITHCODE_API_KEY is not set." };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ZENITH_BASE}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const bodyText = await res.text().catch(() => "");
    if (res.ok) {
      let messageId: string | undefined;
      try {
        const j = JSON.parse(bodyText) as {
          messageId?: string;
          id?: string;
          data?: { messageId?: string; id?: string };
        };
        messageId = j.messageId ?? j.id ?? j.data?.messageId ?? j.data?.id;
      } catch {
        /* non-JSON success body — fine, no id */
      }
      return { ok: true, status: res.status, messageId };
    }
    return {
      ok: false,
      status: res.status,
      error: `Zenith ${res.status}`,
      bodyText: bodyText.slice(0, 500),
    };
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "AbortError";
    return {
      ok: false,
      timedOut,
      error: timedOut ? "Zenith timeout (8s)" : e instanceof Error ? e.message : "network error",
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Send an approved template (OTP-shape: code + customerName). Every required
 *  field is validated + sanitized BEFORE the call; a missing one throws a clear
 *  error naming the field instead of a blind 422. */
export async function sendZenithTemplate(args: {
  to: string;
  code: string;
  customerName?: string;
}): Promise<ZenithResult> {
  const to = requireField("to", toDigits(args.to));
  const template = requireField("template", process.env.ZENITHCODE_TEMPLATE_NAME ?? "login_otp");
  const language = requireField("language", process.env.ZENITHCODE_TEMPLATE_LANG ?? "en_US");
  const code = requireField("code", args.code);
  const customerName = sanitizeCustomerName(args.customerName); // never empty
  return zenithPost("/whatsapp/template", { to, template, language, code, customerName });
}

/** Free-form message (inside the 24h service window). */
export async function sendZenithText(args: {
  to: string;
  message: string;
  customerName?: string;
}): Promise<ZenithResult> {
  const to = requireField("to", toDigits(args.to));
  const message = requireField("message", args.message);
  const customerName = sanitizeCustomerName(args.customerName); // never empty
  return zenithPost("/whatsapp", { to, message, customerName });
}
