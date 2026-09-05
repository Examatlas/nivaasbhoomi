import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { connectDB } from "@/lib/db/connect";
import { PasswordResetToken } from "@/lib/db/models/PasswordResetToken";

/**
 * Email password-reset lifecycle. A single-use, 60-minute token: we email the
 * raw token (in a link) and store only its HMAC, so a leaked DB row can't be
 * used to reset anyone. Rate limited to 3 requests per email+role per 15 min.
 */
export type ResetRole = "user" | "dealer";

export const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const RESET_RATE_LIMIT = 3;
const RESET_RATE_WINDOW_MS = 15 * 60 * 1000;

function pepper(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET is required to hash reset tokens.");
  }
  return secret;
}

function hashToken(token: string): string {
  return createHmac("sha256", pepper()).update(token).digest("hex");
}

/** 32 random bytes as hex — the raw token that goes in the emailed link. */
export function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

export interface IssueResetResult {
  ok: boolean;
  token?: string;
  retryAfterMinutes?: number;
}

/** Rate-limit + persist a fresh reset token. Returns the raw token to email. */
export async function issueReset(
  role: ResetRole,
  email: string,
): Promise<IssueResetResult> {
  await connectDB();

  const windowStart = new Date(Date.now() - RESET_RATE_WINDOW_MS);
  const recent = await PasswordResetToken.countDocuments({
    role,
    email,
    createdAt: { $gte: windowStart },
  });
  if (recent >= RESET_RATE_LIMIT) {
    return { ok: false, retryAfterMinutes: 15 };
  }

  const token = generateResetToken();
  await PasswordResetToken.create({
    role,
    email,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
  });
  return { ok: true, token };
}

export type ConsumeResult =
  | { ok: true; email: string }
  | { ok: false; reason: "invalid" | "expired" };

/**
 * Verify + burn a reset token. Returns the email it was issued for. Constant-
 * time compare on the hash; on success every outstanding token for that
 * email+role is burned so the link can't be replayed.
 */
export async function consumeReset(
  role: ResetRole,
  token: string,
): Promise<ConsumeResult> {
  await connectDB();

  const tokenHash = hashToken(token);
  const doc = await PasswordResetToken.findOne({ role, usedAt: null })
    .where("tokenHash")
    .equals(tokenHash)
    .exec();

  if (!doc) return { ok: false, reason: "invalid" };
  if (doc.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };

  // Defensive constant-time confirm (the query already matched on hash).
  const a = Buffer.from(doc.tokenHash, "hex");
  const b = Buffer.from(tokenHash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "invalid" };
  }

  const email = doc.email;
  doc.usedAt = new Date();
  await doc.save();
  await PasswordResetToken.updateMany(
    { role, email, usedAt: null },
    { $set: { usedAt: new Date() } },
  );
  return { ok: true, email };
}
