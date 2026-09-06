import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { connectDB } from "@/lib/db/connect";
import { Otp } from "@/lib/db/models/Otp";
import { OtpRequestLog } from "@/lib/db/models/OtpRequestLog";
import { hashPassword } from "@/lib/auth/password";
import {
  normalizeIndianMobile,
  generateOtpCode,
  rateLimitDecision,
  OTP_RATE_WINDOW_SECONDS,
} from "@/lib/auth/otp-login";
import { sendOtpTemplate } from "@/lib/auth/otp-whatsapp";

/**
 * POST /api/auth/otp/send   { phone }
 *
 * Sends a 6-digit login OTP over WhatsApp. Rate limited 3/hour/phone and
 * 10/hour/IP. The code is stored only as a bcrypt hash; exactly one active code
 * per phone (the prior one is deleted first). The raw OTP is NEVER returned.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ phone: z.string().trim().min(1).max(20) });

export const POST = withErrorHandling(async (req: NextRequest) => {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fail("VALIDATION_ERROR", "A phone number is required.");

  const phone = normalizeIndianMobile(parsed.data.phone);
  if (!phone) return fail("VALIDATION_ERROR", "Enter a valid 10-digit Indian mobile number.");

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  await connectDB();

  // Rate limit: count sends in the last hour, by phone and by IP.
  const windowStart = new Date(Date.now() - OTP_RATE_WINDOW_SECONDS * 1000);
  const [phoneCount, ipCount] = await Promise.all([
    OtpRequestLog.countDocuments({ phone, createdAt: { $gte: windowStart } }),
    OtpRequestLog.countDocuments({ ip, createdAt: { $gte: windowStart } }),
  ]);
  const decision = rateLimitDecision(phoneCount, ipCount);
  if (!decision.allowed) {
    return fail("RATE_LIMITED", "Too many OTP requests. Please try again later.", {
      retryAfter: decision.retryAfter,
    });
  }
  await OtpRequestLog.create({ phone, ip });

  // Issue: one active code per phone.
  const code = generateOtpCode();
  const codeHash = await hashPassword(code);
  await Otp.deleteMany({ phone });
  const otp = await Otp.create({ phone, codeHash, purpose: "login", attempts: 0 });

  const result = await sendOtpTemplate(phone, code);
  if (!result.ok) {
    // Don't leave a code the user can never receive.
    await Otp.deleteOne({ _id: otp._id });
    console.error(`[otp] send FAILED phone=***${phone.slice(-4)} ${result.error ?? "unknown error"}`);
    // 502: the failure is upstream (Meta), not a client error.
    return NextResponse.json(
      {
        success: false,
        error: { code: "SERVER_ERROR", message: "Couldn't send the code over WhatsApp. Please try again." },
      },
      { status: 502 },
    );
  }
  console.info(`[otp] sent phone=***${phone.slice(-4)} messageId=${result.messageId ?? "unknown"}`);

  return ok({ sent: true });
});
