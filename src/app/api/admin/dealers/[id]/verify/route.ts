import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";

/**
 * POST /api/admin/dealers/[id]/verify   [admin]   (Sections 7, 13)
 *   body: { pan?, aadhaar?, gst?, udyam?, rera?, officePhoto?, notes? }
 *
 * Marks documents verified; the model recomputes verificationTier from them.
 * This is the minimal verification action needed so a dealer's listings can be
 * approved - full document review UI is Phase 6.
 */
const bodySchema = z.object({
  pan: z.boolean().optional(),
  aadhaar: z.boolean().optional(),
  gst: z.boolean().optional(),
  udyam: z.boolean().optional(),
  rera: z.boolean().optional(),
  officePhoto: z.boolean().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/admin/dealers/[id]/verify">) => {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail("VALIDATION_ERROR", "Invalid dealer id.");
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid verification request.");
    }

    await connectDB();
    const dealer = await Dealer.findById(id);
    if (!dealer) return fail("NOT_FOUND", "Dealer not found.");

    dealer.documents ??= {};
    for (const key of [
      "pan",
      "aadhaar",
      "gst",
      "udyam",
      "rera",
      "officePhoto",
    ] as const) {
      const val = parsed.data[key];
      if (val !== undefined) {
        dealer.documents[key] = { ...(dealer.documents[key] ?? {}), verified: val };
      }
    }
    if (parsed.data.notes !== undefined) dealer.verificationNotes = parsed.data.notes;
    dealer.verifiedAt = new Date();

    // The pre-validate hook recomputes verificationTier from the documents.
    await dealer.save();

    return ok({ _id: String(dealer._id), verificationTier: dealer.verificationTier });
  },
);
