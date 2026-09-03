import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireDealer } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { State } from "@/lib/db/models/State";

/**
 * POST /api/dealers/[id]/documents   [dealer auth, self]  (DEV-SPEC.txt S4, S13)
 *   body: { type, url, number?, stateId?, lat?, lng? }
 *
 * The dealer uploads a verification document (the file is already on Cloudinary;
 * we store its url + any number/stateId). We NEVER set `verified` here - only an
 * admin verifies, in the admin panel, and the Dealer hook derives the tier from
 * verified docs. Uploading (or replacing) a document resets its `verified` flag
 * to false, so a changed document must be re-checked.
 *
 * Ownership: the URL id must equal the session dealerId.
 */
const objectId = z
  .string()
  .refine((v) => mongoose.Types.ObjectId.isValid(v), "Invalid id");

const bodySchema = z.object({
  type: z.enum(["pan", "aadhaar", "gst", "udyam", "rera", "officePhoto"]),
  url: z.string().trim().url().max(500),
  number: z.string().trim().max(60).optional(),
  stateId: objectId.optional(),
  lat: z.number().min(6).max(38).optional(),
  lng: z.number().min(68).max(98).optional(),
});

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/dealers/[id]/documents">) => {
    const auth = await requireDealer();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (id !== auth.identity.dealerId) {
      return fail("FORBIDDEN", "You can only upload your own documents.");
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid document.", parsed.error.flatten());
    }
    const { type, url, number, stateId, lat, lng } = parsed.data;

    // RERA needs a state; validate it when provided.
    if (type === "rera" && stateId) {
      await connectDB();
      const exists = await State.countDocuments({ _id: stateId });
      if (!exists) return fail("VALIDATION_ERROR", "Invalid RERA state.");
    } else {
      await connectDB();
    }

    const dealer = await Dealer.findById(id);
    if (!dealer) return fail("NOT_FOUND", "Dealer not found.");

    const docs = (dealer.documents ?? {}) as Record<string, unknown>;
    const entry: Record<string, unknown> = {
      url,
      verified: false, // dealer upload is never self-verified
    };
    if (type === "gst" || type === "udyam" || type === "rera") {
      if (number) entry.number = number;
    }
    if (type === "rera" && stateId) entry.stateId = new mongoose.Types.ObjectId(stateId);
    if (type === "officePhoto") {
      if (lat != null) entry.lat = lat;
      if (lng != null) entry.lng = lng;
    }
    docs[type] = entry;
    dealer.set("documents", docs);
    dealer.markModified("documents");

    await dealer.save(); // hook re-derives tier (still 0 for unverified uploads)

    return ok({ id: String(dealer._id), type, uploaded: true, verified: false });
  },
);
