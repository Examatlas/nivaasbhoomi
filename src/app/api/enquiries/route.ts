import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { normalisePhone } from "@/lib/utils/whatsapp";
import { createEnquiry } from "@/lib/leads/enquiry";

/**
 * POST /api/enquiries   (public - buyer-facing, launch flow)
 *   body: { name, phone, listingId?, message? }
 *
 * Saves a buyer enquiry as a Lead + routes it (no WhatsApp needed). Public and
 * unauthenticated - it's a buyer submitting a form - so it carries a light
 * per-IP throttle and strict phone validation to blunt spam.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(120),
  phone: z.string().trim().min(6).max(20),
  listingId: z.string().trim().optional().nullable(),
  message: z.string().trim().max(1000).optional(),
});

// Best-effort per-IP throttle (single instance). 8 enquiries / 10 min.
const hits = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX = 8;
function throttled(ip: string): boolean {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX;
}

function validIndianMobile(phone: string): boolean {
  return /^91[6-9]\d{9}$/.test(phone);
}

export const POST = withErrorHandling(async (req: NextRequest) => {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (throttled(ip)) {
    return fail("RATE_LIMITED", "Too many enquiries. Please try again in a few minutes.");
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Please check the form.", parsed.error.flatten());
  }

  const phone = normalisePhone(parsed.data.phone);
  if (!validIndianMobile(phone)) {
    return fail("VALIDATION_ERROR", "Enter a valid 10-digit Indian mobile number.");
  }

  const result = await createEnquiry({
    name: parsed.data.name,
    phone,
    listingId: parsed.data.listingId ?? null,
    message: parsed.data.message,
  });

  return ok({ received: true, leadId: result.leadId });
});
