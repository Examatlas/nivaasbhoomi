import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireDealer } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";

/**
 * PATCH /api/dealers/[id]   [dealer auth, self]   (DEV-SPEC.txt Sections 4, 7)
 *   body: { name, businessName, email?, profilePhoto?, coverageCities[],
 *           coverageLocalities[] }
 *
 * A dealer edits ONLY their own profile + coverage. The id in the URL must equal
 * the session dealerId - a dealer can never touch another dealer's record. This
 * route can never change verificationTier, documents.*.verified, status or plan
 * (those are admin-only); it only writes the fields below.
 */
const objectId = (label: string) =>
  z.string().refine((v) => mongoose.Types.ObjectId.isValid(v), `Invalid ${label}`);

const bodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  businessName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  profilePhoto: z.string().trim().url().max(500).optional().or(z.literal("")),
  coverageCities: z.array(objectId("cityId")).max(100).default([]),
  coverageLocalities: z.array(objectId("localityId")).max(500).default([]),
});

export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/dealers/[id]">) => {
    const auth = await requireDealer();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    // Ownership: the URL id must be the signed-in dealer. Never trust the client.
    if (id !== auth.identity.dealerId) {
      return fail("FORBIDDEN", "You can only edit your own profile.");
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Please check the form.", parsed.error.flatten());
    }
    const data = parsed.data;

    await connectDB();

    // Validate coverage references exist, and that every coverage locality
    // belongs to one of the coverage cities (keeps routing data consistent).
    const cityIds = [...new Set(data.coverageCities)];
    const localityIds = [...new Set(data.coverageLocalities)];
    if (cityIds.length > 0) {
      const found = await City.countDocuments({ _id: { $in: cityIds } });
      if (found !== cityIds.length) {
        return fail("VALIDATION_ERROR", "One or more coverage cities are invalid.");
      }
    }
    if (localityIds.length > 0) {
      const locs = await Locality.find(
        { _id: { $in: localityIds } },
        { cityId: 1 },
      ).lean();
      if (locs.length !== localityIds.length) {
        return fail("VALIDATION_ERROR", "One or more coverage localities are invalid.");
      }
      const citySet = new Set(cityIds);
      const orphan = locs.some((l) => !citySet.has(String(l.cityId)));
      if (orphan) {
        return fail(
          "VALIDATION_ERROR",
          "Every coverage locality must sit inside a selected coverage city.",
        );
      }
    }

    const dealer = await Dealer.findById(id);
    if (!dealer) return fail("NOT_FOUND", "Dealer not found.");

    dealer.name = data.name;
    dealer.businessName = data.businessName;
    dealer.email = data.email || undefined;
    if (data.profilePhoto) dealer.profilePhoto = data.profilePhoto;
    else dealer.profilePhoto = undefined;
    dealer.coverageCities = cityIds.map((c) => new mongoose.Types.ObjectId(c));
    dealer.coverageLocalities = localityIds.map((l) => new mongoose.Types.ObjectId(l));

    await dealer.save(); // pre-validate hook re-derives tier (unchanged here)

    return ok({ id: String(dealer._id), profileComplete: cityIds.length > 0 });
  },
);
