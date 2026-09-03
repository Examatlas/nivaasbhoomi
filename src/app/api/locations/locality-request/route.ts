import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { connectDB } from "@/lib/db/connect";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireDealer } from "@/lib/auth/middleware";
import { generateLocalitySlug } from "@/lib/utils/slug";

/**
 * POST /api/locations/locality-request   [dealer auth]  (DEV-SPEC.txt Section 7)
 *   body: { cityId, name, pincode, lat, lng }
 *   -> creates a Locality with status 'pending'
 *   -> returns { localityId } so a listing can reference it while it awaits
 *      admin approval (a listing then goes to status 'pending-location').
 *
 * The dealer supplies a locality that isn't in our seeded set. We create it
 * pending; an admin later approves it (writes introText/FAQ) via the location
 * manager, which is what makes it eligible to go active.
 *
 * Decision: lat/lng are accepted but optional here - the precise map pin is part
 * of the Phase-4 dealer form; a listing can still be created and linked before
 * the pin exists. A slug is generated now (unique within the city) so the
 * required field and the { cityId, slug } index are satisfied immediately.
 */
const bodySchema = z.object({
  cityId: z.string().refine((v) => mongoose.Types.ObjectId.isValid(v), "Invalid cityId"),
  name: z.string().trim().min(2, "Locality name is too short").max(120),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Pincode must be 6 digits")
    .optional(),
  lat: z.number().min(6).max(38).optional(),
  lng: z.number().min(68).max(98).optional(),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  // Dealer-gated (stubbed until Phase 4). Denies in production, dev stub allows.
  const auth = requireDealer();
  if ("error" in auth) return auth.error;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Invalid locality request.", parsed.error.flatten());
  }
  const { cityId, name, pincode, lat, lng } = parsed.data;

  await connectDB();

  const city = await City.findById(cityId, { stateId: 1 }).lean();
  if (!city) return fail("NOT_FOUND", "City not found.");

  // If this exact place already exists in the city (case-insensitive name),
  // return it rather than creating a duplicate - the dealer still gets a
  // localityId to link to.
  const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const existing = await Locality.findOne(
    { cityId, name: new RegExp(`^${escaped}$`, "i") },
    { _id: 1 },
  ).lean();
  if (existing) {
    return ok({ localityId: String(existing._id), existing: true });
  }

  // Otherwise generate a slug that is unique within this city (suffixing on the
  // rare chance a different name already holds the base slug).
  const existingSlugs = new Set(
    (await Locality.find({ cityId }, { slug: 1 }).lean()).map((l) => l.slug),
  );
  const slug = generateLocalitySlug(name, (s) => existingSlugs.has(s));

  const created = await Locality.create({
    name: name.trim(),
    slug,
    cityId: new mongoose.Types.ObjectId(cityId),
    stateId: city.stateId,
    pincodes: pincode ? [pincode] : [],
    ...(lat != null ? { lat } : {}),
    ...(lng != null ? { lng } : {}),
    status: "pending",
    isActive: false,
    ...(auth.identity.dealerId
      ? { requestedBy: new mongoose.Types.ObjectId(auth.identity.dealerId) }
      : {}),
  });

  return ok({ localityId: String(created._id), existing: false });
});
