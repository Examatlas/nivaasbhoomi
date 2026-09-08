import type { NextRequest } from "next/server";
import mongoose from "mongoose";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { Dealer } from "@/lib/db/models/Dealer";
import { City } from "@/lib/db/models/City";
import { dealerRegistrationSchema } from "@/lib/dealers/register";
import { DEFAULT_MONTHLY_QUOTA } from "@/lib/leads/quota-config";
import { nextMonthlyReset } from "@/lib/leads/quota-reset-date";
import { logDealerAudit } from "@/lib/dealers/audit";
import { normalizeRegId, validateRegId } from "@/lib/validation/registration-ids";

/**
 * POST /api/admin/users/[id]/convert-to-dealer   [admin]
 *
 * Turn a buyer User into a Dealer (STEP 2) — the rescue path for the orphan
 * Users, and for future admin-created dealers. Unlike self-signup, an
 * admin-converted dealer is created ACTIVE (no pending approval). The User and
 * Dealer are linked both ways; a Dealer already on the phone is a hard error
 * (never duplicate). Every conversion is audit-logged with the data entered.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/admin/users/[id]/convert-to-dealer">) => {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return fail("NOT_FOUND", "User not found.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
    }
    const parsed = dealerRegistrationSchema.safeParse(json);
    if (!parsed.success) return fail("VALIDATION_ERROR", "Please complete the form.", parsed.error.flatten());
    const b = parsed.data;

    await connectDB();
    const user = await User.findById(id);
    if (!user) return fail("NOT_FOUND", "User not found.");
    if (user.dealerId) return fail("DUPLICATE", "This user is already a dealer.");

    // A dealer already on this phone → hard error, never duplicate.
    const existing = await Dealer.findOne({ phone: user.phone }, { _id: 1, userId: 1 }).lean();
    if (existing) {
      return fail("DUPLICATE", "A dealer already exists on this phone number.");
    }

    // Optional reg-ids + coverage cities must be valid.
    for (const [kind, val] of [
      ["gst", b.gstNumber],
      ["udyam", b.udyamNumber],
      ["rera", b.reraNumber],
    ] as const) {
      if (val) {
        const msg = validateRegId(kind, val);
        if (msg) return fail("VALIDATION_ERROR", msg);
      }
    }
    const cityOids = b.coverageCities.map((c) => new mongoose.Types.ObjectId(c));
    const cityCount = await City.countDocuments({ _id: { $in: b.coverageCities } });
    if (cityCount !== new Set(b.coverageCities).size) {
      return fail("VALIDATION_ERROR", "One or more coverage cities are invalid.");
    }

    const documents: Record<string, unknown> = {};
    if (b.gstNumber) documents.gst = { number: normalizeRegId(b.gstNumber), verified: false };
    if (b.udyamNumber) documents.udyam = { number: normalizeRegId(b.udyamNumber), verified: false };
    if (b.reraNumber) documents.rera = { number: normalizeRegId(b.reraNumber), verified: false };

    const dealer = await Dealer.create({
      name: user.name || b.businessName,
      businessName: b.businessName,
      phone: user.phone,
      phoneVerified: Boolean(user.phoneVerified),
      userId: user._id,
      // Admin-converted dealers go straight to ACTIVE (self-signup stays pending).
      status: "active",
      maxLeadsPerMonth: DEFAULT_MONTHLY_QUOTA,
      leadsUsedThisMonth: 0,
      quotaResetAt: nextMonthlyReset(),
      lastResetAt: new Date(),
      dealTypes: b.dealTypes,
      coverageCities: cityOids,
      coverageLocalities: b.coverageLocalities.map((l) => new mongoose.Types.ObjectId(l)),
      ...(Object.keys(documents).length ? { documents } : {}),
    });

    user.dealerId = dealer._id as mongoose.Types.ObjectId;
    await user.save();

    await logDealerAudit({
      action: "dealer.admin-convert",
      actorId: auth.identity.adminId,
      dealerId: String(dealer._id),
      reason: "Admin converted user to dealer",
      metadata: {
        userId: String(user._id),
        businessName: b.businessName,
        dealTypes: b.dealTypes,
        coverageCities: b.coverageCities,
        coverageLocalities: b.coverageLocalities,
        gst: b.gstNumber ?? null,
        udyam: b.udyamNumber ?? null,
        rera: b.reraNumber ?? null,
      },
    });

    return ok({ dealerId: String(dealer._id), status: "active" });
  },
);
