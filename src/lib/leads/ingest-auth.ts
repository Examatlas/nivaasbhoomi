import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify that an inbound lead push really came from Zenith Code (Section 11
 * privacy: only Zenith may create leads). We DEFINE this contract - it's our
 * receiving endpoint - and configure Zenith to match. Two accepted schemes:
 *
 *   1. HMAC (preferred):  X-Zenith-Signature: sha256=<hex(hmac_sha256(rawBody, secret))>
 *   2. Static shared key:  X-Ingest-Secret: <secret>   (if Zenith can only send a
 *                          fixed header)
 *
 * Constant-time comparison. If no secret is configured we reject (secure
 * default) - an unverifiable push is never processed.
 */
export function verifyIngestRequest(
  rawBody: string,
  headers: { signature: string | null; sharedSecret: string | null },
  secret: string,
): boolean {
  if (!secret) return false;

  // Scheme 1: HMAC signature.
  const sig = headers.signature;
  if (sig) {
    const provided = sig.startsWith("sha256=") ? sig.slice(7) : sig;
    const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
    if (safeEqualHex(expected, provided)) return true;
  }

  // Scheme 2: static shared secret header.
  if (headers.sharedSecret && safeEqualUtf8(headers.sharedSecret, secret)) return true;

  return false;
}

function safeEqualHex(a: string, b: string): boolean {
  let ba: Buffer;
  let bb: Buffer;
  try {
    ba = Buffer.from(a, "hex");
    bb = Buffer.from(b, "hex");
  } catch {
    return false;
  }
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function safeEqualUtf8(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
