import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireStaff } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { AccessRequest } from "@/lib/db/models/AccessRequest";
import { staffCanAccessDealer } from "@/lib/staff/scope";
import { logAudit } from "@/lib/leads/assign";

/**
 * GET  /api/staff/access-requests   [staff] — this staff's own requests.
 * POST /api/staff/access-requests   [staff] — request access to a dealer the
 *   staff does NOT already have. Max 10 PENDING requests per staff; a duplicate
 *   pending request for the same dealer is rejected.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PENDING = 10;

export const GET = withErrorHandling(async (_req: NextRequest) => {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  await connectDB();
  const rows = await AccessRequest.find(
    { staffId: new mongoose.Types.ObjectId(auth.identity.staffId) },
    { dealerId: 1, reason: 1, status: 1, requestedAt: 1, reviewedAt: 1, adminNote: 1 },
  )
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return ok(
    rows.map((r) => ({
      _id: String(r._id),
      dealerId: String(r.dealerId),
      reason: r.reason ?? null,
      status: r.status,
      requestedAt: r.requestedAt ? new Date(r.requestedAt).toISOString() : null,
      reviewedAt: r.reviewedAt ? new Date(r.reviewedAt).toISOString() : null,
      adminNote: r.adminNote ?? null,
    })),
  );
});

const createSchema = z.object({
  dealerId: z.string().refine((v) => mongoose.Types.ObjectId.isValid(v), "Invalid dealerId"),
  reason: z.string().trim().max(500).optional(),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return fail("VALIDATION_ERROR", "A valid dealerId is required.");

  const staffId = auth.identity.staffId;
  const { dealerId } = parsed.data;

  await connectDB();
  if (!(await Dealer.exists({ _id: new mongoose.Types.ObjectId(dealerId) }))) {
    return fail("NOT_FOUND", "Dealer not found.");
  }
  // No point requesting access you already have.
  if (await staffCanAccessDealer(staffId, dealerId)) {
    return fail("VALIDATION_ERROR", "You already have access to this dealer.");
  }

  // Rate limit: at most MAX_PENDING open requests per staff.
  const pending = await AccessRequest.countDocuments({
    staffId: new mongoose.Types.ObjectId(staffId),
    status: "pending",
  });
  if (pending >= MAX_PENDING) {
    return fail("RATE_LIMITED", `You already have ${MAX_PENDING} pending access requests.`);
  }

  try {
    const doc = await AccessRequest.create({
      staffId: new mongoose.Types.ObjectId(staffId),
      dealerId: new mongoose.Types.ObjectId(dealerId),
      reason: parsed.data.reason,
      status: "pending",
      requestedAt: new Date(),
    });
    await logAudit({
      action: "access.request",
      actor: { actorType: "staff", actorId: staffId },
      dealerId,
      metadata: { accessRequestId: String(doc._id) },
    });
    return ok({ _id: String(doc._id), status: "pending" });
  } catch (err) {
    // Partial-unique index (staffId, dealerId) on pending → duplicate request.
    if ((err as { code?: number }).code === 11000) {
      return fail("DUPLICATE", "You already have a pending request for this dealer.");
    }
    throw err;
  }
});
