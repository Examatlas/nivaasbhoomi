import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireStaff } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { staffDealerFilter } from "@/lib/staff/scope";
import { logAudit } from "@/lib/leads/assign";
import { slugify } from "@/lib/utils/slug";
import { nanoidLower } from "@/lib/utils/id";
import { normalizeIndianMobile } from "@/lib/auth/otp-login";

/**
 * GET  /api/staff/dealers   [staff] — dealers in THIS staff's scope only.
 * POST /api/staff/dealers   [staff] — onboard a new dealer (onboardedBy = self).
 *
 * The scope filter is derived server-side from the session staffId; a client
 * can never widen it.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  await connectDB();
  const scope = await staffDealerFilter(auth.identity.staffId);
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const filter: Record<string, unknown> = q
    ? { $and: [scope, { $or: [{ name: new RegExp(q, "i") }, { businessName: new RegExp(q, "i") }, { phone: new RegExp(q, "i") }] }] }
    : scope;

  const dealers = await Dealer.find(filter, {
    name: 1,
    businessName: 1,
    phone: 1,
    status: 1,
    verificationTier: 1,
    listingCount: 1,
    onboardedBy: 1,
    createdAt: 1,
  })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  return ok(
    dealers.map((d) => ({
      _id: String(d._id),
      name: d.name,
      businessName: d.businessName,
      phone: d.phone,
      status: d.status,
      verificationTier: d.verificationTier ?? 0,
      listingCount: d.listingCount ?? 0,
      mine: String(d.onboardedBy ?? "") === auth.identity.staffId,
    })),
  );
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  businessName: z.string().trim().min(1).max(160),
  phone: z.string().trim().min(1).max(20),
  email: z.string().trim().toLowerCase().email().max(200).optional().or(z.literal("")),
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
  if (!parsed.success) return fail("VALIDATION_ERROR", "Invalid dealer.", parsed.error.flatten());

  const phone = normalizeIndianMobile(parsed.data.phone);
  if (!phone) return fail("VALIDATION_ERROR", "Enter a valid 10-digit Indian mobile number.");

  await connectDB();
  if (await Dealer.exists({ phone })) {
    return fail("DUPLICATE", "A dealer with this phone already exists.");
  }

  const base = slugify(parsed.data.businessName);
  let slug = base;
  if (await Dealer.exists({ slug })) slug = `${base}-${nanoidLower(4)}`;

  const dealer = await Dealer.create({
    name: parsed.data.name,
    businessName: parsed.data.businessName,
    phone,
    email: parsed.data.email || undefined,
    slug,
    status: "active",
    onboardedBy: auth.identity.staffId, // the scoping anchor
  });

  await logAudit({
    action: "dealer.onboard",
    actor: { actorType: "staff", actorId: auth.identity.staffId },
    dealerId: String(dealer._id),
    metadata: { businessName: dealer.businessName, phone },
  });

  return ok({ _id: String(dealer._id), businessName: dealer.businessName, slug: dealer.slug });
});
