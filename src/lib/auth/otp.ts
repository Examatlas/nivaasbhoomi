import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { connectDB } from "@/lib/db/connect";
import { OtpToken } from "@/lib/db/models/OtpToken";

/**
 * Dealer OTP lifecycle (DEV-SPEC.txt Section 8): 6-digit code, 10-minute TTL,
 * 3 sends per phone per 10 minutes, at most 5 verify attempts per code.
 *
 * The code is stored only as an HMAC (keyed by JWT_SECRET), never in the clear.
 * Verification is constant-time.
 */

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_RATE_LIMIT = 3; // sends per phone per window
export const OTP_MAX_ATTEMPTS = 5; // verify attempts per code

function pepper(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET is required to hash OTPs.");
  }
  return secret;
}

function hashCode(phone: string, code: string): string {
  // Bind the hash to the phone so a code is only valid for its own number.
  return createHmac("sha256", pepper()).update(`${phone}:${code}`).digest("hex");
}

/** Cryptographically-random 6-digit code (000000-999999). */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export interface IssueResult {
  ok: boolean;
  code?: string; // returned to the caller so it can be sent (never persisted raw)
  retryAfterMinutes?: number;
}

/** Rate-limit check + persist a fresh OTP. Returns the raw code to send. */
export async function issueOtp(phone: string): Promise<IssueResult> {
  await connectDB();

  const windowStart = new Date(Date.now() - OTP_TTL_MS);
  const recent = await OtpToken.countDocuments({
    phone,
    createdAt: { $gte: windowStart },
  });
  if (recent >= OTP_RATE_LIMIT) {
    return { ok: false, retryAfterMinutes: 10 };
  }

  const code = generateOtp();
  await OtpToken.create({
    phone,
    codeHash: hashCode(phone, code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });
  return { ok: true, code };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "expired" | "mismatch" | "too_many_attempts" };

/** Verify a submitted code against the most recent unused token for the phone. */
export async function verifyOtp(phone: string, code: string): Promise<VerifyResult> {
  await connectDB();

  const token = await OtpToken.findOne({
    phone,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .exec();

  if (!token) return { ok: false, reason: "expired" };

  if ((token.attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
    return { ok: false, reason: "too_many_attempts" };
  }

  const expected = Buffer.from(token.codeHash, "hex");
  const actual = Buffer.from(hashCode(phone, code), "hex");
  const match =
    expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!match) {
    token.attempts = (token.attempts ?? 0) + 1;
    await token.save();
    return { ok: false, reason: "mismatch" };
  }

  // Success: burn this token and any other outstanding tokens for the phone so a
  // code can never be replayed.
  token.usedAt = new Date();
  await token.save();
  await OtpToken.updateMany(
    { phone, usedAt: null },
    { $set: { usedAt: new Date() } },
  );
  return { ok: true };
}
