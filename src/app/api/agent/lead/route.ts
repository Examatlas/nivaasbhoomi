import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAgentDealer, logAgentRequest } from "@/lib/agent/auth";
import { createAgentLead } from "@/lib/agent/lead";
import { normalizeIndianMobile } from "@/lib/auth/otp-login";

/**
 * POST /api/agent/lead   [dealer agent key]
 *
 * Creates a lead from the dealer's OWN Zenith agent. Source "whatsapp_agent",
 * assigned directly to the key's dealer (rotation bypassed). Shared dedup (24h),
 * seed listings blocked (422). Body: { name?, phone, listingId?, message?, intent? }.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().min(1).max(20),
  listingId: z.string().trim().max(60).optional(),
  message: z.string().trim().max(2000).optional(),
  intent: z.string().trim().max(120).optional(),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const start = Date.now();
  const guard = await requireAgentDealer(req);
  if ("error" in guard) return guard.error;
  const { dealerId } = guard.ctx;

  const finish = (status: number) => logAgentRequest(dealerId, "lead", status, Date.now() - start);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    await finish(422);
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    await finish(422);
    return fail("VALIDATION_ERROR", "Please check the fields.", parsed.error.flatten());
  }

  const phone = normalizeIndianMobile(parsed.data.phone);
  if (!phone) {
    await finish(422);
    return fail("VALIDATION_ERROR", "Enter a valid 10-digit Indian mobile number.");
  }

  const r = await createAgentLead({
    dealerId,
    name: parsed.data.name,
    phone,
    listingId: parsed.data.listingId ?? null,
    message: parsed.data.message,
    intent: parsed.data.intent,
  });

  if (!r.ok) {
    await finish(422);
    return fail("VALIDATION_ERROR", r.message); // seed listing → 422
  }

  const res = ok({ leadId: r.leadId, deduped: r.deduped, assigned: r.assignedNow });
  await finish(200);
  return res;
});
