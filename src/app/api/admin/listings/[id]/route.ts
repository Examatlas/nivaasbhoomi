import type { NextRequest } from "next/server";
import { after } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Listing } from "@/lib/db/models/Listing";
import { Dealer } from "@/lib/db/models/Dealer";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";
import { State } from "@/lib/db/models/State";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { listingAdminEditSchema } from "@/lib/listings/schema";
import { revalidateListingPublicPaths } from "@/lib/listings/revalidate";
import {
  recalculateCounters,
  recalculateLocalityActivation,
} from "@/lib/locations/activation";
import { logAudit } from "@/lib/leads/assign";
import { notifyDealer } from "@/lib/notifications/dealer-events";

/** Fields whose before/after we track for the audit trail (SEO edit focus). */
const TRACKED_FIELDS = ["title", "description", "metaTitle", "metaDescription", "slug"] as const;
const FIELD_LABEL: Record<string, string> = {
  title: "title",
  description: "description",
  metaTitle: "meta title",
  metaDescription: "meta description",
  slug: "URL",
};
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * GET   /api/admin/listings/[id]   [admin] - full detail incl. dealer + tier.
 * PATCH /api/admin/listings/[id]   [admin] - edit fields incl. SEO + slug.
 *   A slug change pushes the old slug into previousSlugs (301 forever), is
 *   dup-checked against other listings' current + previous slugs, is audited
 *   (before/after per field), and notifies the dealer (listing_updated).
 */
export const GET = withErrorHandling(
  async (_req: NextRequest, ctx: RouteContext<"/api/admin/listings/[id]">) => {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail("VALIDATION_ERROR", "Invalid listing id.");
    }

    await connectDB();
    const l = await Listing.findById(id).lean();
    if (!l) return fail("NOT_FOUND", "Listing not found.");

    // Guard every foreign-id lookup: a listing with a missing/invalid stored id
    // would otherwise CastError (String(undefined) → "undefined").
    const [dealer, city, locality, state] = await Promise.all([
      mongoose.isValidObjectId(l.dealerId)
        ? Dealer.findById(l.dealerId, {
            name: 1,
            businessName: 1,
            phone: 1,
            verificationTier: 1,
            rating: 1,
            ratingCount: 1,
            status: 1,
          }).lean()
        : null,
      mongoose.isValidObjectId(l.cityId)
        ? City.findById(l.cityId, { name: 1, slug: 1 }).lean()
        : null,
      mongoose.isValidObjectId(l.localityId)
        ? Locality.findById(l.localityId, { name: 1, slug: 1, status: 1 }).lean()
        : null,
      mongoose.isValidObjectId(l.stateId)
        ? State.findById(l.stateId, { name: 1 }).lean()
        : null,
    ]);

    // Admin sees full listing (incl. fullAddress and dealer phone) - the privacy
    // rules restrict PUBLIC exposure, not the admin console.
    return ok({
      ...l,
      _id: String(l._id),
      dealerId: l.dealerId ? String(l.dealerId) : null,
      cityId: l.cityId ? String(l.cityId) : null,
      localityId: l.localityId ? String(l.localityId) : null,
      stateId: l.stateId ? String(l.stateId) : null,
      dealer: dealer
        ? {
            _id: String(dealer._id),
            name: dealer.name,
            businessName: dealer.businessName,
            phone: dealer.phone,
            verificationTier: dealer.verificationTier ?? 0,
            rating: dealer.rating ?? 0,
            ratingCount: dealer.ratingCount ?? 0,
            status: dealer.status,
          }
        : null,
      city: city ? { _id: String(city._id), name: city.name, slug: city.slug } : null,
      locality: locality
        ? { _id: String(locality._id), name: locality.name, slug: locality.slug }
        : null,
      state: state ? { name: state.name } : null,
    });
  },
);

export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/admin/listings/[id]">) => {
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
    const parsed = listingAdminEditSchema.safeParse(json);
    if (!parsed.success) {
      return fail(
        "VALIDATION_ERROR",
        "Please fix the listing details.",
        parsed.error.flatten(),
      );
    }

    // Optional slug edit — read from the raw body (not part of the create schema).
    let newSlug: string | undefined;
    if (json && typeof json === "object" && "slug" in json) {
      const raw = (json as { slug?: unknown }).slug;
      if (typeof raw === "string") {
        newSlug = raw.trim().toLowerCase();
        if (!SLUG_RE.test(newSlug) || newSlug.length < 3 || newSlug.length > 120) {
          return fail(
            "VALIDATION_ERROR",
            "Slug must be lowercase letters, numbers and hyphens (3–120 chars).",
          );
        }
      }
    }

    await connectDB();
    const listing = await Listing.findById(id);
    if (!listing) return fail("NOT_FOUND", "Listing not found.");

    // Snapshot tracked fields BEFORE any mutation, for the audit diff.
    const before: Record<string, string> = {};
    for (const f of TRACKED_FIELDS) before[f] = String((listing as unknown as Record<string, unknown>)[f] ?? "");

    // Assign the provided SEO fields; slug is handled explicitly below.
    Object.assign(listing, parsed.data);

    // Slug change → dup-check + push old into previousSlugs (301 forever).
    let oldSlug: string | null = null;
    if (newSlug && newSlug !== listing.slug) {
      const clash = await Listing.findOne(
        { _id: { $ne: listing._id }, $or: [{ slug: newSlug }, { previousSlugs: newSlug }] },
        { _id: 1 },
      ).lean();
      if (clash) {
        return fail("DUPLICATE", "That slug is already used (current or past) by another listing.");
      }
      oldSlug = listing.slug ?? null;
      const history = new Set(listing.previousSlugs ?? []);
      if (oldSlug) history.add(oldSlug);
      history.delete(newSlug); // if reclaiming an old slug, drop it from history
      listing.previousSlugs = [...history];
      listing.slug = newSlug;
    }

    try {
      await listing.save();
    } catch (err) {
      if (err instanceof mongoose.Error.ValidationError) {
        const fieldErrors = Object.fromEntries(
          Object.entries(err.errors).map(([k, e]) => [k, [e.message]]),
        );
        return fail("VALIDATION_ERROR", "Listing failed validation.", { fieldErrors });
      }
      throw err;
    }

    // Compute the changed tracked fields (before → after) for the audit trail.
    const changes: Record<string, { from: string; to: string }> = {};
    for (const f of TRACKED_FIELDS) {
      const to = String((listing as unknown as Record<string, unknown>)[f] ?? "");
      if (to !== before[f]) changes[f] = { from: before[f] ?? "", to };
    }
    const changedFields = Object.keys(changes);

    if (changedFields.length > 0) {
      // Audit (best-effort, never blocks the edit).
      await logAudit({
        action: "listing.edit",
        actor: { actorType: "admin", actorId: auth.identity.adminId },
        listingId: String(listing._id),
        dealerId: mongoose.isValidObjectId(listing.dealerId) ? String(listing.dealerId) : undefined,
        metadata: { changes },
      });

      // Notify the dealer (best-effort, after the response). Summary = changed fields.
      const summary =
        changedFields.map((f) => FIELD_LABEL[f] ?? f).join(", ").replace(/^./, (c) => c.toUpperCase()) +
        " updated by our team.";
      const dealer = mongoose.isValidObjectId(listing.dealerId)
        ? await Dealer.findById(listing.dealerId, { name: 1, phone: 1 }).lean()
        : null;
      if (dealer) {
        const dealerId = String(dealer._id);
        const dealerName = dealer.name;
        const dealerPhone = dealer.phone;
        const listingId = String(listing._id);
        const listingTitle = listing.title;
        after(() =>
          notifyDealer({
            event: "listing_updated",
            dealerId,
            dealerName,
            dealerPhone,
            entityId: listingId,
            listingTitle,
            changeSummary: summary,
          }),
        );
      }
    }

    // Revalidate public pages: the current slug always; the old slug on a change
    // (so the old /property/<slug> refreshes into its 301), plus the city /
    // locality / home cards that show this listing.
    await revalidateListingPublicPaths({
      slug: listing.slug,
      previousSlug: oldSlug,
      cityId: listing.cityId,
      localityId: listing.localityId,
    });

    // If the listing is live, its edited fields may change counters/activation.
    if (listing.status === "approved") {
      await Promise.all([
        recalculateCounters(listing.cityId!),
        recalculateLocalityActivation(listing.localityId!),
      ]);
    }

    return ok({ _id: String(listing._id), slug: listing.slug ?? null, changed: changedFields });
  },
);
