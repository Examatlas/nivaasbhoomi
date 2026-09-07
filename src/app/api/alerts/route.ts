import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { SavedSearch } from "@/lib/db/models/SavedSearch";
import { createSavedSearch } from "@/lib/alerts/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const objectId = z.string().refine((v) => /^[a-f0-9]{24}$/i.test(v), "Invalid id");

const criteriaSchema = z.object({
  cityId: objectId,
  localityIds: z.array(objectId).max(50).optional(),
  propertyType: z.string().trim().max(40).nullable().optional(),
  purpose: z.enum(["buy", "rent"]),
  budgetMin: z.number().nonnegative().nullable().optional(),
  budgetMax: z.number().nonnegative().nullable().optional(),
  bedrooms: z.string().trim().max(10).nullable().optional(),
});

/** POST /api/alerts  [buyer] — create a saved-search alert from current filters. */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = z.object({ criteria: criteriaSchema }).safeParse(json);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Please check the alert criteria.");

  await connectDB();
  const user = await User.findById(auth.identity.userId, { phone: 1 }).lean();
  if (!user?.phone) return fail("UNAUTHORIZED", "Please sign in again.");

  const res = await createSavedSearch({
    userId: auth.identity.userId,
    phone: user.phone,
    criteria: parsed.data.criteria,
  });
  if (!res.ok) return fail("VALIDATION_ERROR", res.error);
  return ok({ id: res.id });
});

/** GET /api/alerts  [buyer] — the buyer's own alerts. */
export const GET = withErrorHandling(async () => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  await connectDB();
  const user = await User.findById(auth.identity.userId, { phone: 1 }).lean();
  if (!user?.phone) return ok({ alerts: [] });
  const alerts = await SavedSearch.find({ phone: user.phone }).sort({ createdAt: -1 }).lean();
  return ok({
    alerts: alerts.map((a) => ({
      id: String(a._id),
      criteria: a.criteria,
      active: a.active,
      frequency: a.frequency,
      unsubscribedAt: a.unsubscribedAt,
      lastNotifiedAt: a.lastNotifiedAt,
    })),
  });
});
