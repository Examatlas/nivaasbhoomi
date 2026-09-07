import type { NextRequest } from "next/server";
import mongoose from "mongoose";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { LocalityRate } from "@/lib/db/models/LocalityRate";

/**
 * GET /api/internal/rates?localityId=&propertyType=&purpose=   [admin only]
 *
 * INTERNAL (never public in Phase 4A). Always returns sampleCount + dataQuality.
 * When dataQuality is "insufficient", the rate NUMBERS are withheld — status only,
 * so no thin/unreliable figure can ever leak.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const sp = req.nextUrl.searchParams;
  const localityId = sp.get("localityId") ?? "";
  const propertyType = sp.get("propertyType") ?? "";
  const purpose = sp.get("purpose") ?? "";

  if (!mongoose.Types.ObjectId.isValid(localityId)) {
    return fail("VALIDATION_ERROR", "A valid localityId is required.");
  }
  if (!["flat", "plot", "house", "commercial"].includes(propertyType)) {
    return fail("VALIDATION_ERROR", "propertyType must be flat|plot|house|commercial.");
  }
  if (!["buy", "rent"].includes(purpose)) {
    return fail("VALIDATION_ERROR", "purpose must be buy|rent.");
  }

  await connectDB();
  const rate = await LocalityRate.findOne({
    localityId: new mongoose.Types.ObjectId(localityId),
    propertyType: propertyType as "flat" | "plot" | "house" | "commercial",
    purpose: purpose as "buy" | "rent",
  }).lean();

  if (!rate) {
    return ok({ found: false, sampleCount: 0, dataQuality: "insufficient" as const });
  }

  const baseline = {
    found: true,
    localityId,
    propertyType,
    purpose,
    sampleCount: rate.sampleCount ?? 0,
    dataQuality: rate.dataQuality,
    computedAt: rate.computedAt,
  };

  // Never expose numbers for insufficient data.
  if (rate.dataQuality === "insufficient") return ok(baseline);

  return ok({
    ...baseline,
    medianPricePerSqft: rate.medianPricePerSqft,
    minPricePerSqft: rate.minPricePerSqft,
    maxPricePerSqft: rate.maxPricePerSqft,
    p25PricePerSqft: rate.p25PricePerSqft,
    p75PricePerSqft: rate.p75PricePerSqft,
    medianTotalPrice: rate.medianTotalPrice,
  });
});
