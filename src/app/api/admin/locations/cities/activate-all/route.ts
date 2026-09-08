import { connectDB } from "@/lib/db/connect";
import { City } from "@/lib/db/models/City";
import { Listing } from "@/lib/db/models/Listing";
import { canActivateCity, activateCity } from "@/lib/locations/activation";
import { ok, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";

/**
 * POST /api/admin/locations/cities/activate-all   [admin]
 *
 * Activate every inactive city that already meets the activation guard, in one
 * click. Enforces the SAME guard as the per-city endpoint (canActivateCity /
 * activateCity — live counts), so nothing premature slips through.
 *
 * Bounded to cities that have at least one approved listing (a city with none
 * can never pass the listings threshold), so this never scans all of India.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withErrorHandling(async () => {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  await connectDB();

  const cityIdsWithListings = await Listing.distinct("cityId", { status: "approved" });
  const candidates = await City.find(
    { isActive: { $ne: true }, _id: { $in: cityIdsWithListings } },
    { name: 1, slug: 1 },
  ).lean();

  const activated: { slug: string; name: string }[] = [];
  const skipped: { slug: string; name: string; reason: string }[] = [];

  for (const c of candidates) {
    const check = await canActivateCity(c._id);
    if (check.ok) {
      await activateCity(c._id);
      activated.push({ slug: c.slug, name: c.name });
    } else {
      skipped.push({ slug: c.slug, name: c.name, reason: check.missing[0] ?? "Not eligible." });
    }
  }

  return ok({ activatedCount: activated.length, activated, skipped });
});
