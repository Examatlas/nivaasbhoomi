import type { NextRequest } from "next/server";
import mongoose from "mongoose";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireStaff } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { staffCanAccessDealer } from "@/lib/staff/scope";

/**
 * GET /api/staff/dealers/[id]   [staff, scoped]
 *
 * Returns the dealer ONLY if it is in the staff's scope; otherwise 404 (we never
 * confirm the existence of a dealer outside the staff's scope, even with a valid
 * id in the URL).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(
  async (_req: NextRequest, ctx: RouteContext<"/api/staff/dealers/[id]">) => {
    const auth = await requireStaff();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return fail("NOT_FOUND", "Dealer not found.");
    if (!(await staffCanAccessDealer(auth.identity.staffId, id))) {
      return fail("NOT_FOUND", "Dealer not found."); // out of scope → 404, never leak
    }

    await connectDB();
    const d = await Dealer.findById(id, {
      name: 1,
      businessName: 1,
      phone: 1,
      email: 1,
      status: 1,
      verificationTier: 1,
      documents: 1,
      listingCount: 1,
      onboardedBy: 1,
    }).lean();
    if (!d) return fail("NOT_FOUND", "Dealer not found.");

    return ok({
      _id: String(d._id),
      name: d.name,
      businessName: d.businessName,
      phone: d.phone,
      email: d.email ?? null,
      status: d.status,
      verificationTier: d.verificationTier ?? 0,
      documents: d.documents ?? {},
      listingCount: d.listingCount ?? 0,
      mine: String(d.onboardedBy ?? "") === auth.identity.staffId,
    });
  },
);
