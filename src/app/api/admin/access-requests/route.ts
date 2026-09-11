import type { NextRequest } from "next/server";
import mongoose from "mongoose";

import { ok, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { AccessRequest } from "@/lib/db/models/AccessRequest";
import { Staff } from "@/lib/db/models/Staff";
import { Dealer } from "@/lib/db/models/Dealer";

/**
 * GET /api/admin/access-requests?status=pending   [admin]
 *
 * The admin review queue (this list IS the in-app notification — no WhatsApp).
 * Defaults to pending; resolves staff + dealer names for display.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  await connectDB();
  const raw = req.nextUrl.searchParams.get("status") ?? "pending";
  const status: "pending" | "approved" | "rejected" =
    raw === "approved" || raw === "rejected" ? raw : "pending";
  const filter = raw === "all" ? {} : { status };
  const rows = await AccessRequest.find(filter).sort({ createdAt: -1 }).limit(200).lean();

  const staffIds = [...new Set(rows.map((r) => String(r.staffId)))];
  const dealerIds = [...new Set(rows.map((r) => String(r.dealerId)))];
  const [staff, dealers] = await Promise.all([
    Staff.find({ _id: { $in: staffIds.map((s) => new mongoose.Types.ObjectId(s)) } }, { name: 1, email: 1 }).lean(),
    Dealer.find({ _id: { $in: dealerIds.map((s) => new mongoose.Types.ObjectId(s)) } }, { businessName: 1 }).lean(),
  ]);
  const staffName = new Map(staff.map((s) => [String(s._id), s.name]));
  const dealerName = new Map(dealers.map((d) => [String(d._id), d.businessName]));

  return ok(
    rows.map((r) => ({
      _id: String(r._id),
      staffId: String(r.staffId),
      staffName: staffName.get(String(r.staffId)) ?? "—",
      dealerId: String(r.dealerId),
      dealerName: dealerName.get(String(r.dealerId)) ?? "—",
      reason: r.reason ?? null,
      status: r.status,
      requestedAt: r.requestedAt ? new Date(r.requestedAt).toISOString() : null,
    })),
  );
});
