import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { connectDB } from "@/lib/db/connect";
import { Listing } from "@/lib/db/models/Listing";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";

/**
 * POST /api/admin/listings/[id]/badges   [admin]   (Section 15)
 *   body: { documentsChecked?, photosVerified?, siteVisited? }
 *
 * Sets the public trust badges the admin confirms during review. Only the
 * provided flags are changed.
 */
const bodySchema = z
  .object({
    documentsChecked: z.boolean().optional(),
    photosVerified: z.boolean().optional(),
    siteVisited: z.boolean().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, "No badge flags provided.");

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/admin/listings/[id]/badges">) => {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail("VALIDATION_ERROR", "Invalid listing id.");
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Provide at least one badge flag.");
    }

    const set: Record<string, boolean> = {};
    if (parsed.data.documentsChecked !== undefined) {
      set["badges.documentsChecked"] = parsed.data.documentsChecked;
    }
    if (parsed.data.photosVerified !== undefined) {
      set["badges.photosVerified"] = parsed.data.photosVerified;
    }
    if (parsed.data.siteVisited !== undefined) {
      set["badges.siteVisited"] = parsed.data.siteVisited;
    }

    await connectDB();
    const updated = await Listing.findByIdAndUpdate(
      id,
      { $set: set },
      { new: true, projection: { badges: 1 } },
    ).lean();
    if (!updated) return fail("NOT_FOUND", "Listing not found.");

    return ok({ badges: updated.badges });
  },
);
