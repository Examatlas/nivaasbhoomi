import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify Meta's X-Hub-Signature-256 header (DEV-SPEC.txt Section 11).
 *
 * The header is `sha256=<hex>` where <hex> is HMAC-SHA256 of the RAW request
 * body keyed by WHATSAPP_APP_SECRET. The comparison is constant-time. If the
 * app secret isn't configured we reject (secure default) - an unverifiable
 * webhook must never be processed.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return false;
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.slice("sha256=".length);

  let a: Buffer;
  let b: Buffer;
  try {
    a = Buffer.from(expected, "hex");
    b = Buffer.from(provided, "hex");
  } catch {
    return false;
  }
  return a.length === b.length && timingSafeEqual(a, b);
}
