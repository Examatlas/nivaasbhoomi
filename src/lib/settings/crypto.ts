import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Symmetric encryption for secrets stored in the DB (e.g. the Zenith Code API
 * key + ingest signing secret). AES-256-GCM. The key is derived from JWT_SECRET
 * (already required) via scrypt with a fixed salt, so no new env var is needed;
 * set SETTINGS_ENC_KEY to a 32-byte hex string to override.
 *
 * Ciphertext format: iv(hex):authTag(hex):data(hex). Plaintext is never sent to
 * the client - the admin API returns a masked preview only.
 */
function key(): Buffer {
  const override = process.env.SETTINGS_ENC_KEY;
  if (override && override.length >= 64) return Buffer.from(override.slice(0, 64), "hex");
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET is required to encrypt settings.");
  }
  return scryptSync(secret, "nb-settings-v1", 32);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("Malformed ciphertext.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

/** A masked preview for the admin UI (e.g. "sk_live_…a1b2"), never the secret. */
export function maskSecret(plain: string | undefined): string {
  if (!plain) return "";
  if (plain.length <= 6) return "••••";
  return `${plain.slice(0, 4)}••••${plain.slice(-4)}`;
}
