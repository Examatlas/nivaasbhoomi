import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { Staff } from "@/lib/db/models/Staff";
import { Dealer } from "@/lib/db/models/Dealer";
import { AuditLog } from "@/lib/db/models/AuditLog";
import { hashPassword } from "@/lib/auth/password";
import { logAudit } from "@/lib/leads/assign";

/**
 * GET  /api/admin/staff   [admin] — list staff with quick stats.
 * POST /api/admin/staff   [admin] — create a staff account (email + password).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async (_req: NextRequest) => {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  await connectDB();
  const staff = await Staff.find(
    {},
    { name: 1, email: 1, status: 1, lastLoginAt: 1, createdAt: 1 },
  )
    .sort({ createdAt: -1 })
    .lean();

  // Bulk stats: dealers onboarded per staff, listings published per staff.
  const [onboarded, published] = await Promise.all([
    Dealer.aggregate<{ _id: unknown; n: number }>([
      { $match: { onboardedBy: { $ne: null } } },
      { $group: { _id: "$onboardedBy", n: { $sum: 1 } } },
    ]),
    AuditLog.aggregate<{ _id: string; n: number }>([
      { $match: { action: "listing.publish", actorType: "staff" } },
      { $group: { _id: "$actorId", n: { $sum: 1 } } },
    ]),
  ]);
  const onboardedBy = new Map(onboarded.map((a) => [String(a._id), a.n]));
  const publishedBy = new Map(published.map((a) => [String(a._id), a.n]));

  return ok(
    staff.map((s) => ({
      _id: String(s._id),
      name: s.name,
      email: s.email,
      status: s.status,
      lastLoginAt: s.lastLoginAt ? new Date(s.lastLoginAt).toISOString() : null,
      dealersOnboarded: onboardedBy.get(String(s._id)) ?? 0,
      listingsPublished: publishedBy.get(String(s._id)) ?? 0,
    })),
  );
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Name, email and a password (8+ chars) are required.", parsed.error.flatten());
  }

  await connectDB();
  if (await Staff.exists({ email: parsed.data.email })) {
    return fail("DUPLICATE", "A staff account with this email already exists.");
  }

  const staff = await Staff.create({
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash: await hashPassword(parsed.data.password),
    status: "active",
    tokenVersion: 0,
    createdBy: auth.identity.adminId,
  });

  await logAudit({
    action: "staff.create",
    actor: { actorType: "admin", actorId: auth.identity.adminId },
    metadata: { staffId: String(staff._id), email: staff.email },
  });

  return ok({ _id: String(staff._id), name: staff.name, email: staff.email });
});
