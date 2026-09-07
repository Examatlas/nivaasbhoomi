import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { SavedSearch } from "@/lib/db/models/SavedSearch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ active: z.boolean() });

async function ownedSearch(userId: string, id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const user = await User.findById(userId, { phone: 1 }).lean();
  if (!user?.phone) return null;
  return SavedSearch.findOne({ _id: id, phone: user.phone });
}

/** PATCH /api/alerts/[id]  [buyer, own] — pause / resume an alert. */
export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/alerts/[id]">) => {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return fail("VALIDATION_ERROR", "Invalid request.");

    await connectDB();
    const search = await ownedSearch(auth.identity.userId, id);
    if (!search) return fail("NOT_FOUND", "Alert not found.");
    search.active = parsed.data.active;
    if (parsed.data.active) {
      search.unsubscribedAt = null;
      search.alertsSinceVisit = 0; // resuming counts as fresh engagement
    }
    await search.save();
    return ok({ id, active: search.active });
  },
);

/** DELETE /api/alerts/[id]  [buyer, own] */
export const DELETE = withErrorHandling(
  async (_req: NextRequest, ctx: RouteContext<"/api/alerts/[id]">) => {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
    await connectDB();
    const search = await ownedSearch(auth.identity.userId, id);
    if (!search) return fail("NOT_FOUND", "Alert not found.");
    await SavedSearch.deleteOne({ _id: search._id });
    return ok({ deleted: true });
  },
);
