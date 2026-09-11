import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireStaff } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { staffCanAccessDealer } from "@/lib/staff/scope";
import { logAudit } from "@/lib/leads/assign";

/**
 * POST /api/staff/dealers/[id]/verify   [staff, scoped]
 *   body: { pan?, aadhaar?, gst?, udyam?, rera?, officePhoto? }
 *
 * Staff marks the dealer's documents verified; the model recomputes the tier.
 * Only dealers in the staff's scope can be verified (else 404). Audited.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  pan: z.boolean().optional(),
  aadhaar: z.boolean().optional(),
  gst: z.boolean().optional(),
  udyam: z.boolean().optional(),
  rera: z.boolean().optional(),
  officePhoto: z.boolean().optional(),
});

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/staff/dealers/[id]/verify">) => {
    const auth = await requireStaff();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return fail("NOT_FOUND", "Dealer not found.");
    if (!(await staffCanAccessDealer(auth.identity.staffId, id))) {
      return fail("NOT_FOUND", "Dealer not found.");
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return fail("VALIDATION_ERROR", "Invalid verification request.");

    await connectDB();
    const dealer = await Dealer.findById(id);
    if (!dealer) return fail("NOT_FOUND", "Dealer not found.");

    const prevTier = dealer.verificationTier ?? 0;
    dealer.documents ??= {};
    for (const key of ["pan", "aadhaar", "gst", "udyam", "rera", "officePhoto"] as const) {
      const val = parsed.data[key];
      if (val !== undefined) dealer.documents[key] = { ...(dealer.documents[key] ?? {}), verified: val };
    }
    dealer.verifiedAt = new Date();
    // The model's pre-validate hook recomputes verificationTier from the docs.
    await dealer.save();

    await logAudit({
      action: "dealer.verify",
      actor: { actorType: "staff", actorId: auth.identity.staffId },
      dealerId: String(dealer._id),
      metadata: { fromTier: prevTier, toTier: dealer.verificationTier ?? 0 },
    });

    return ok({ _id: String(dealer._id), verificationTier: dealer.verificationTier ?? 0 });
  },
);
