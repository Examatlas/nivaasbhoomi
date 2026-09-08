import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { getUserSession, requireUser } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { Listing } from "@/lib/db/models/Listing";
import { SavedListing } from "@/lib/db/models/SavedListing";

/**
 * Buyer shortlist (save/unsave) — account-based (DEV-SPEC.txt Section 8: the
 * userId comes only from the verified session, never the client).
 *
 *   GET    /api/saved   -> { ids: string[] }  (empty when logged out — the
 *                          SavedProvider hydrates every heart from one call)
 *   POST   /api/saved   { listingId }  -> save   (idempotent via unique index)
 *   DELETE /api/saved   { listingId }  -> unsave
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  listingId: z.string().refine((v) => mongoose.Types.ObjectId.isValid(v), "Invalid id."),
});

export const GET = withErrorHandling(async () => {
  const session = await getUserSession();
  if (!session) return ok({ ids: [] as string[] });
  await connectDB();
  const rows = await SavedListing.find(
    { userId: session.userId },
    { listingId: 1 },
  ).lean();
  return ok({ ids: rows.map((r) => String(r.listingId)) });
});

async function readListingId(req: NextRequest): Promise<string | null> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return null;
  }
  const parsed = bodySchema.safeParse(json);
  return parsed.success ? parsed.data.listingId : null;
}

export const POST = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const listingId = await readListingId(req);
  if (!listingId) return fail("VALIDATION_ERROR", "A valid listingId is required.");

  await connectDB();
  // Only real, live listings can be shortlisted.
  const exists = await Listing.exists({ _id: listingId, status: "approved" });
  if (!exists) return fail("NOT_FOUND", "Listing not found.");

  // Idempotent: the unique {userId, listingId} index makes a repeat a no-op.
  await SavedListing.updateOne(
    { userId: auth.identity.userId, listingId },
    { $setOnInsert: { userId: auth.identity.userId, listingId } },
    { upsert: true },
  );
  return ok({ saved: true as const });
});

export const DELETE = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const listingId = await readListingId(req);
  if (!listingId) return fail("VALIDATION_ERROR", "A valid listingId is required.");

  await connectDB();
  await SavedListing.deleteOne({ userId: auth.identity.userId, listingId });
  return ok({ saved: false as const });
});
