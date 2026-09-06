import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { connectDB } from "@/lib/db/connect";
import { EmailChangeToken } from "@/lib/db/models/EmailChangeToken";

/**
 * Dealer email-change lifecycle. A single-use, 60-minute token: we email the raw
 * token (in a link) to the NEW address and store only its HMAC, so a leaked DB
 * row can't be used to hijack the change. Rate limited to 3 requests per dealer
 * per 15 min. Mirrors the password-reset token mechanism.
 */
export const EMAIL_CHANGE_TTL_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 15 * 60 * 1000;

function pepper(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET is required to hash email-change tokens.");
  }
  return secret;
}

function hashToken(token: string): string {
  return createHmac("sha256", pepper()).update(token).digest("hex");
}

export interface IssueEmailChangeResult {
  ok: boolean;
  token?: string;
  retryAfterMinutes?: number;
}

/** Rate-limit + persist a fresh email-change token. Returns the raw token. */
export async function issueEmailChange(
  dealerId: string,
  newEmail: string,
): Promise<IssueEmailChangeResult> {
  await connectDB();

  const windowStart = new Date(Date.now() - RATE_WINDOW_MS);
  const recent = await EmailChangeToken.countDocuments({
    dealerId,
    createdAt: { $gte: windowStart },
  });
  if (recent >= RATE_LIMIT) return { ok: false, retryAfterMinutes: 15 };

  const token = randomBytes(32).toString("hex");
  await EmailChangeToken.create({
    dealerId,
    newEmail,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + EMAIL_CHANGE_TTL_MS),
  });
  return { ok: true, token };
}

export type ConsumeEmailChangeResult =
  | { ok: true; dealerId: string; newEmail: string }
  | { ok: false; reason: "invalid" | "expired" };

/**
 * Verify + burn an email-change token. Returns the dealerId + the new email it
 * was issued for. Constant-time compare on the hash; on success every other
 * outstanding token for that dealer is burned so no stale link stays live.
 */
export async function consumeEmailChange(
  token: string,
): Promise<ConsumeEmailChangeResult> {
  await connectDB();

  const tokenHash = hashToken(token);
  const doc = await EmailChangeToken.findOne({ tokenHash, usedAt: null }).exec();
  if (!doc) return { ok: false, reason: "invalid" };
  if (doc.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };

  const a = Buffer.from(doc.tokenHash, "hex");
  const b = Buffer.from(tokenHash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "invalid" };
  }

  const dealerId = String(doc.dealerId);
  const newEmail = doc.newEmail;
  doc.usedAt = new Date();
  await doc.save();
  await EmailChangeToken.updateMany(
    { dealerId: doc.dealerId, usedAt: null },
    { $set: { usedAt: new Date() } },
  );
  return { ok: true, dealerId, newEmail };
}
