import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { getAutomationSettings } from "@/lib/settings/automation";
import { verifyIngestRequest } from "@/lib/leads/ingest-auth";
import { ingestQualifiedLead, type IngestPayload } from "@/lib/leads/ingest";

/**
 * POST /api/leads/ingest   (Zenith Code -> NivaasBhoomi, Section 11/12)
 *
 * Receives a QUALIFIED lead from Zenith Code and drops it into NivaasBhoomi's DB
 * + routing. Secured by the ingest signing secret (see lib/leads/ingest-auth) -
 * an unsigned/invalid request is rejected with 403. Never trusts anything but
 * the verified body.
 *
 * Configure Zenith to sign with EITHER:
 *   X-Zenith-Signature: sha256=<hmac_sha256(body, secret)>   (preferred), or
 *   X-Ingest-Secret: <secret>
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const extractedSchema = z
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
  .optional();

const bodySchema = z.object({
  phone: z.string().min(6).max(20),
  profileName: z.string().max(120).optional(),
  message: z.string().max(4000).optional(),
  listingId: z.string().optional().nullable(),
  listingRef: z.string().optional().nullable(),
  extracted: extractedSchema,
  qualificationScore: z.number().min(0).max(100).optional(),
  isQualified: z.boolean().optional(),
  stage: z.enum(["greeting", "qualifying", "qualified", "closing"]).optional(),
  eventId: z.string().max(200).optional(),
  messageId: z.string().max(200).optional(),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const raw = await req.text();

  const { ingestSigningSecret } = await getAutomationSettings();
  if (!ingestSigningSecret) {
    // Can't verify -> refuse (secure default).
    return fail("SERVER_ERROR", "Ingest signing secret is not configured.");
  }

  const verified = verifyIngestRequest(
    raw,
    {
      signature: req.headers.get("x-zenith-signature"),
      sharedSecret: req.headers.get("x-ingest-secret"),
    },
    ingestSigningSecret,
  );
  if (!verified) {
    return fail("FORBIDDEN", "Invalid or missing ingest signature.");
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return fail("VALIDATION_ERROR", "Body must be valid JSON.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Invalid lead payload.", parsed.error.flatten());
  }

  const result = await ingestQualifiedLead(parsed.data as IngestPayload);
  return ok(result);
});
