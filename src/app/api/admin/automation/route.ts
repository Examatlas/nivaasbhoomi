import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import {
  getAutomationSettingsView,
  saveAutomationSettings,
} from "@/lib/settings/automation";

/**
 * GET/PUT /api/admin/automation   [admin]
 *
 * GET returns a MASKED view (no secrets). PUT saves; secret fields left blank
 * keep the current stored value, so the admin never has to re-type them.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  return ok(await getAutomationSettingsView());
});

const putSchema = z.object({
  provider: z.enum(["zenith", "meta"]).optional(),
  zenithBaseUrl: z.string().trim().max(300).optional(),
  zenithAccountId: z.string().trim().max(200).optional(),
  zenithApiKey: z.string().max(400).optional(),
  ingestSigningSecret: z.string().max(400).optional(),
});

export const PUT = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Body must be valid JSON.");
  }
  const parsed = putSchema.safeParse(json);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Invalid settings.", parsed.error.flatten());
  }

  await saveAutomationSettings(parsed.data, auth.identity.adminId);
  return ok(await getAutomationSettingsView());
});
