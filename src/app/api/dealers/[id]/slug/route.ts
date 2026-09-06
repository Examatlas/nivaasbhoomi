import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireDealer } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { validateDealerSlug } from "@/lib/dealers/slug";
import { isDealerSlugAvailable } from "@/lib/dealers/slug-server";
import { revalidateDealerPublicPages } from "@/lib/listings/revalidate";

/**
 * PATCH /api/dealers/[id]/slug   [dealer auth, self]   body: { slug }
 *
 * A MANUAL slug change from the dealer panel. Validates format + availability +
 * the 30-day change lock (which starts from the first manual change). The old
 * slug is pushed to slugHistory so it 301-redirects to the new one; if the new
 * slug was itself historical, it's removed from history (loop-safe). Public
 * pages are revalidated (old + new).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ slug: z.string().trim().toLowerCase().min(1).max(80) });

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/dealers/[id]/slug">) => {
    const auth = await requireDealer();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
    if (id !== auth.identity.dealerId) {
      return fail("FORBIDDEN", "You can only edit your own link.");
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return fail("VALIDATION_ERROR", "A slug is required.");
    const next = parsed.data.slug;

    const format = validateDealerSlug(next);
    if (!format.ok) return fail("VALIDATION_ERROR", format.reason);

    await connectDB();
    const dealer = await Dealer.findById(id);
    if (!dealer) return fail("NOT_FOUND", "Dealer not found.");

    // No-op if unchanged.
    if (dealer.slug === next) return ok({ slug: next, changed: false });

    // 30-day lock (from the first manual change).
    if (dealer.slugLockUntil && dealer.slugLockUntil.getTime() > Date.now()) {
      const until = dealer.slugLockUntil.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      return fail("FORBIDDEN", `Your link is locked until ${until}. You can change it once every 30 days.`);
    }

    if (!(await isDealerSlugAvailable(next, id))) {
      return fail("DUPLICATE", "That link is already taken. Try another.");
    }

    const old = dealer.slug ?? null;
    // Keep the old slug so it 301s to the new one; never let the new slug also
    // sit in history (that would make it both current and a redirect source).
    const history = new Set(dealer.slugHistory ?? []);
    if (old) history.add(old);
    history.delete(next);
    dealer.slugHistory = [...history];
    dealer.slug = next;
    dealer.slugManuallyChangedAt = new Date();
    dealer.slugLockUntil = new Date(Date.now() + THIRTY_DAYS_MS);
    await dealer.save();

    // Refresh the old URL (now a 301 source) and the dealer's public pages.
    if (old) revalidatePath(`/agent/${old}`);
    await revalidateDealerPublicPages(id);

    return ok({ slug: next, changed: true, lockedUntil: dealer.slugLockUntil.toISOString() });
  },
);
