import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { validateDealerSlug } from "@/lib/dealers/slug";
import { isDealerSlugAvailable } from "@/lib/dealers/slug-server";
import { sanitizeAbout } from "@/lib/security/sanitize";
import { revalidateDealerPublicPages } from "@/lib/listings/revalidate";

/**
 * PATCH /api/admin/dealers/[id]   [admin]   (Phase 5 — force-edit)
 *
 * The admin override for a dealer. Unlike the dealer's own /profile route, this
 * can edit ANY field — identity (name/businessName/email), account status, the
 * slug (bypassing the dealer's 30-day change lock), the full public profile, and
 * the verified flag on each private verificationDocs entry. `about` is still
 * sanitized server-side (stored XSS is never acceptable, admin or not). Document
 * tier verification stays on its own /verify route (it recomputes the tier);
 * this route never touches verificationTier directly. Public pages revalidate.
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
  // Identity + account (admin-only)
  name: z.string().trim().min(1).max(120).optional(),
  businessName: z.string().trim().min(1).max(160).optional(),
  email: z.string().trim().toLowerCase().email().max(200).optional().or(z.literal("")),
  status: z.enum(["active", "paused", "banned"]).optional(),
  slug: z.string().trim().toLowerCase().min(1).max(80).optional(),
  // Toggle the verified flag on private verification documents, by index.
  docVerifications: z
    .array(z.object({ index: z.number().int().min(0), verified: z.boolean() }))
    .max(50)
    .optional(),
  // Public profile (same shape as the dealer's own editor)
  tagline: z.string().trim().max(120).optional(),
  about: z.string().max(8000).optional(),
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
  reraNumber: z.string().trim().max(40).optional(),
  gstNumber: z.string().trim().max(40).optional(),
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
  async (req: NextRequest, ctx: RouteContext<"/api/admin/dealers/[id]">) => {
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

    const oldSlug = dealer.slug ?? null;

    // Slug: admin override — validate format + availability, but bypass the
    // dealer's 30-day change lock. The old slug is kept in history so it 301s.
    if (b.slug !== undefined && b.slug !== dealer.slug) {
      const format = validateDealerSlug(b.slug);
      if (!format.ok) return fail("VALIDATION_ERROR", format.reason);
      if (!(await isDealerSlugAvailable(b.slug, id))) {
        return fail("DUPLICATE", "That link is already taken by another dealer.");
      }
      const history = new Set(dealer.slugHistory ?? []);
      if (oldSlug) history.add(oldSlug);
      history.delete(b.slug);
      dealer.slugHistory = [...history];
      dealer.slug = b.slug;
      dealer.slugManuallyChangedAt = new Date();
    }

    const set = (key: string, value: unknown) => {
      if (value !== undefined) (dealer as unknown as Record<string, unknown>)[key] = value;
    };

    // Identity + account
    set("name", b.name);
    set("businessName", b.businessName);
    set("email", b.email);
    set("status", b.status);

    // Public profile
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

    // Private verification documents: toggle verified by index (admin-only).
    if (b.docVerifications?.length) {
      const docs = dealer.verificationDocs ?? [];
      for (const { index, verified } of b.docVerifications) {
        if (docs[index]) docs[index].verified = verified;
      }
      dealer.verificationDocs = docs;
    }

    await dealer.save();

    if (oldSlug && dealer.slug !== oldSlug) revalidatePath(`/agent/${oldSlug}`);
    await revalidateDealerPublicPages(id);

    return ok({ saved: true, slug: dealer.slug });
  },
);
