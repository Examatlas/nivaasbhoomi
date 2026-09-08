import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { connectDB } from "@/lib/db/connect";
import { Listing } from "@/lib/db/models/Listing";
import { ListingReport, REPORT_REASONS } from "@/lib/db/models/ListingReport";

/**
 * POST /api/listings/[id]/report   { reason, note? }   (public)
 *
 * Anyone can flag a listing (no auth — abuse is bounded by a rate limit instead:
 * 3 reports/hour/IP, counted from recent ListingReport rows). The reason is one
 * of a fixed set; note is optional free text. Reports land in the admin queue.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPORTS_PER_IP = 3;
const WINDOW_SECONDS = 3600;

const bodySchema = z.object({
  reason: z.enum(REPORT_REASONS),
  note: z.string().trim().max(1000).optional(),
});

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/listings/[id]/report">) => {
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail("NOT_FOUND", "Listing not found.");
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Please choose a valid reason.");
    }

    await connectDB();

    const listing = await Listing.exists({ _id: id });
    if (!listing) return fail("NOT_FOUND", "Listing not found.");

    // Rate limit: 3 reports/hour/IP.
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const recent = await ListingReport.countDocuments({
      ip,
      createdAt: { $gte: new Date(Date.now() - WINDOW_SECONDS * 1000) },
    });
    if (recent >= REPORTS_PER_IP) {
      return fail("RATE_LIMITED", "Too many reports. Please try again later.", {
        retryAfter: WINDOW_SECONDS,
      });
    }

    await ListingReport.create({
      listingId: id,
      reason: parsed.data.reason,
      note: parsed.data.note,
      ip,
      status: "open",
    });

    return ok({ reported: true as const });
  },
);
