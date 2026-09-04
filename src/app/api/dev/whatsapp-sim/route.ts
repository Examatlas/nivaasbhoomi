import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { normalisePhone } from "@/lib/utils/whatsapp";
import {
  processInboundMessage,
  type InboundEvent,
} from "@/lib/whatsapp/webhook-process";
import type { N8nResponse } from "@/lib/whatsapp/n8n";
import { Dealer } from "@/lib/db/models/Dealer";

/**
 * DEV-ONLY: simulate an inbound WhatsApp message so the webhook -> n8n -> reply
 * -> lead-save path is testable without a live WABA (DEV-SPEC.txt Section 11,
 * testability). It builds an InboundEvent and runs the SAME processing the real
 * webhook uses - but bypasses the X-Hub signature (there's no Meta call) and
 * awaits the result so you can see the reply, lead id and qualification.
 *
 * REFUSES in production. Never mounted behind the public webhook.
 *
 *   POST /api/dev/whatsapp-sim
 *   { phone, text, listingId?, profileName?, mockAi? }
 *
 * If N8N_WEBHOOK_URL is set, the real n8n is called. Otherwise pass `mockAi`
 * (an n8n-shaped response) to exercise the reply + lead-save downstream offline.
 */
const isProd = process.env.NODE_ENV === "production";

const mockAiSchema = z.object({
  reply: z.string(),
  extracted: z
    .object({
      name: z.string().optional(),
      purpose: z.string().optional(),
      propertyType: z.string().optional(),
      bhk: z.string().optional(),
      budgetMin: z.number().optional(),
      budgetMax: z.number().optional(),
      timeline: z.string().optional(),
      loanRequired: z.boolean().optional(),
      cityName: z.string().optional(),
      localityName: z.string().optional(),
      siteVisitSlot: z.string().optional(),
    })
    .optional(),
  qualificationScore: z.number().min(0).max(100).optional(),
  isQualified: z.boolean().optional(),
  stage: z.enum(["greeting", "qualifying", "qualified", "closing"]).optional(),
});

const bodySchema = z.object({
  phone: z.string().trim().min(1).max(20),
  text: z.string().min(1).max(4000),
  listingId: z.string().trim().optional(),
  profileName: z.string().trim().max(120).optional(),
  mockAi: mockAiSchema.optional(),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  if (isProd) {
    return fail("FORBIDDEN", "The WhatsApp simulator is disabled in production.");
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "phone and text are required.", parsed.error.flatten());
  }
  const { phone, text, listingId, profileName, mockAi } = parsed.data;

  // Append the hidden [Ref: <id>] tag if a listingId was given and the text
  // doesn't already carry one (mirrors the real CTA deep link).
  let message = text;
  if (listingId && !/\[Ref:/i.test(text)) {
    message = `${text}\n[Ref: ${listingId}]`;
  }

  const evt: InboundEvent = {
    from: normalisePhone(phone),
    messageId: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: message,
    profileName,
  };

  const result = await processInboundMessage(evt, {
    aiOverride: mockAi as N8nResponse | undefined,
  });

  // Resolve the routed dealer's name so the outcome is self-explanatory.
  let routedDealer: { id: string; businessName: string; tier: number; quota: string } | undefined;
  if (result.routing?.dealerId) {
    const d = await Dealer.findById(result.routing.dealerId, {
      businessName: 1,
      verificationTier: 1,
      leadsUsedThisMonth: 1,
      maxLeadsPerMonth: 1,
    }).lean();
    if (d) {
      routedDealer = {
        id: String(d._id),
        businessName: d.businessName,
        tier: d.verificationTier ?? 0,
        quota: `${d.leadsUsedThisMonth}/${d.maxLeadsPerMonth}`,
      };
    }
  }

  return ok({
    simulated: evt,
    result,
    routedDealer,
    hint:
      result.status === "n8n_unconfigured"
        ? "Set N8N_WEBHOOK_URL, or pass `mockAi` to test the reply + lead path offline."
        : undefined,
  });
});
