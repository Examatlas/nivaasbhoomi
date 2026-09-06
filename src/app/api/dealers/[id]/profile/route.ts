import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireDealer } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { sanitizeAbout } from "@/lib/security/sanitize";
import { revalidateDealerPublicPages } from "@/lib/listings/revalidate";
import { validateRegId, normalizeRegId } from "@/lib/validation/registration-ids";

/**
 * PATCH /api/dealers/[id]/profile   [dealer auth, self]
 *
 * The dealer edits their public-profile fields. This route can NEVER change
 * verification status, the badge, verificationDocs, slug, or plan (those are
 * admin-only / have their own endpoint). The about field is SANITIZED
 * server-side before it is stored — no stored XSS. Images must be Cloudinary
 * uploads. Public pages are revalidated on save.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cloudinaryUrl = z
  .string()
  .trim()
  .url()
  .max(600)
  .refine((u) => u.startsWith("https://res.cloudinary.com/"), "Image must be a Cloudinary upload.");

const image = z
  .object({ url: cloudinaryUrl, publicId: z.string().trim().max(200).optional() })
  .nullable()
  .optional();

const CURRENT_YEAR = new Date().getFullYear();

const bodySchema = z.object({
  tagline: z.string().trim().max(120).optional(),
  about: z.string().max(8000).optional(), // capped again after sanitize
  establishedYear: z.number().int().min(1900).max(CURRENT_YEAR).nullable().optional(),
  yearsExperience: z.number().int().min(0).max(100).nullable().optional(),
  teamSize: z.number().int().min(0).max(100000).nullable().optional(),
  dealTypes: z
    .array(z.enum(["plot", "flat", "house", "commercial", "rent", "resale"]))
    .max(6)
    .optional(),
  languages: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  priceRangeMin: z.number().min(0).nullable().optional(),
  priceRangeMax: z.number().min(0).nullable().optional(),
  reraNumber: z
    .string()
    .trim()
    .max(40)
    .transform(normalizeRegId)
    .refine((v) => validateRegId("rera", v) === null, "Enter a valid RERA number (8–30 chars).")
    .optional(),
  gstNumber: z
    .string()
    .trim()
    .max(40)
    .transform(normalizeRegId)
    .refine((v) => validateRegId("gst", v) === null, "Enter a valid 15-character GSTIN.")
    .optional(),
  officeAddress: z.string().trim().max(300).optional(),
  mapLat: z.number().min(-90).max(90).nullable().optional(),
  mapLng: z.number().min(-180).max(180).nullable().optional(),
  workingHours: z
    .array(
      z.object({
        day: z.string().trim().max(12),
        open: z.string().trim().max(8).optional(),
        close: z.string().trim().max(8).optional(),
        closed: z.boolean().default(false),
      }),
    )
    .max(7)
    .optional(),
  publicEmail: z.string().trim().toLowerCase().email().max(200).optional().or(z.literal("")),
  publicEmailOptIn: z.boolean().optional(),
  publicPhoneOptIn: z.boolean().optional(),
  bannerImage: image,
  logoImage: image,
});

export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/dealers/[id]/profile">) => {
    const auth = await requireDealer();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
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
    const b = parsed.data;

    // about: sanitize server-side, then enforce the 2000-char text cap.
    let about: string | undefined;
    if (b.about !== undefined) {
      about = sanitizeAbout(b.about);
      const textLen = about.replace(/<[^>]+>/g, "").trim().length;
      if (textLen > 2000) {
        return fail("VALIDATION_ERROR", "About is too long (max 2000 characters).");
      }
    }

    await connectDB();
    const dealer = await Dealer.findById(id);
    if (!dealer) return fail("NOT_FOUND", "Dealer not found.");

    // Assign only the editable fields. `undefined` = not sent (leave as-is);
    // empty string / null = clear.
    const set = <K extends string>(key: K, value: unknown) => {
      if (value !== undefined) (dealer as unknown as Record<string, unknown>)[key] = value;
    };
    set("tagline", b.tagline);
    if (about !== undefined) dealer.about = about;
    set("establishedYear", b.establishedYear ?? undefined);
    set("yearsExperience", b.yearsExperience ?? undefined);
    set("teamSize", b.teamSize ?? undefined);
    set("dealTypes", b.dealTypes);
    set("languages", b.languages);
    set("priceRangeMin", b.priceRangeMin ?? undefined);
    set("priceRangeMax", b.priceRangeMax ?? undefined);
    set("reraNumber", b.reraNumber);
    set("gstNumber", b.gstNumber);
    set("officeAddress", b.officeAddress);
    set("mapLat", b.mapLat ?? undefined);
    set("mapLng", b.mapLng ?? undefined);
    set("workingHours", b.workingHours);
    set("publicEmail", b.publicEmail);
    set("publicEmailOptIn", b.publicEmailOptIn);
    set("publicPhoneOptIn", b.publicPhoneOptIn);
    if (b.bannerImage !== undefined) dealer.bannerImage = b.bannerImage;
    if (b.logoImage !== undefined) dealer.logoImage = b.logoImage;

    await dealer.save();
    await revalidateDealerPublicPages(id);

    return ok({ saved: true });
  },
);
