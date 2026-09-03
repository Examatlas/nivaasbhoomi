import type { NextRequest } from "next/server";
import { z } from "zod";

import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { parseListQuery, paginated, escapeRegExp } from "@/lib/api/pagination";
import { slugify } from "@/lib/utils/slug";
import { nanoidLower } from "@/lib/utils/id";

/**
 * GET  /api/admin/dealers   [admin] - searchable, paginated dealer list.
 * POST /api/admin/dealers   [admin] - create a minimal dealer.
 *
 * A Listing requires a dealerId (Section 4). Full dealer onboarding is Phase 4
 * (WhatsApp OTP), but the admin must be able to attach an owner to a manually
 * entered listing now - so admin can create a minimal dealer here.
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  await connectDB();
  const query = parseListQuery(req, 25);

  const filter: Record<string, unknown> = {};
  if (query.q) {
    const rx = new RegExp(escapeRegExp(query.q), "i");
    filter.$or = [{ name: rx }, { businessName: rx }, { phone: rx }];
  }

  const [items, total] = await Promise.all([
    Dealer.find(filter, {
      name: 1,
      businessName: 1,
      phone: 1,
      verificationTier: 1,
      status: 1,
      listingCount: 1,
    })
      .sort({ createdAt: -1 })
      .skip(query.skip)
      .limit(query.limit)
      .lean(),
    Dealer.countDocuments(filter),
  ]);

  return ok(
    paginated(
      items.map((d) => ({
        _id: String(d._id),
        name: d.name,
        businessName: d.businessName,
        phone: d.phone,
        verificationTier: d.verificationTier ?? 0,
        status: d.status,
        listingCount: d.listingCount ?? 0,
      })),
      total,
      query,
    ),
  );
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  businessName: z.string().trim().min(2).max(160),
  phone: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, "Phone must be 10-15 digits (with country code)."),
  email: z.string().trim().email().optional().or(z.literal("")),
  /**
   * Documents the admin confirms as verified at creation. The model recomputes
   * verificationTier from these (Section 13), so marking pan+aadhaar makes the
   * dealer Tier 1 - the minimum for their listings to be approvable.
   */
  verified: z
    .object({
      pan: z.boolean().optional(),
      aadhaar: z.boolean().optional(),
      gst: z.boolean().optional(),
      udyam: z.boolean().optional(),
      rera: z.boolean().optional(),
      officePhoto: z.boolean().optional(),
    })
    .optional(),
});

function documentsFrom(verified?: Record<string, boolean | undefined>) {
  if (!verified) return undefined;
  const docs: Record<string, { verified: boolean }> = {};
  for (const key of ["pan", "aadhaar", "gst", "udyam", "rera", "officePhoto"]) {
    if (verified[key]) docs[key] = { verified: true };
  }
  return Object.keys(docs).length ? docs : undefined;
}

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
    return fail("VALIDATION_ERROR", "Invalid dealer.", parsed.error.flatten());
  }

  await connectDB();

  const existing = await Dealer.findOne({ phone: parsed.data.phone }, { _id: 1 }).lean();
  if (existing) {
    return fail("DUPLICATE", "A dealer with this phone already exists.");
  }

  // Public-profile slug (Section 6: slugify(businessName) + nanoid on collision).
  const base = slugify(parsed.data.businessName);
  let slug = base;
  if (await Dealer.exists({ slug })) slug = `${base}-${nanoidLower(4)}`;

  const dealer = await Dealer.create({
    name: parsed.data.name,
    businessName: parsed.data.businessName,
    phone: parsed.data.phone,
    email: parsed.data.email || undefined,
    slug,
    status: "active",
    documents: documentsFrom(parsed.data.verified),
  });

  return ok({
    _id: String(dealer._id),
    name: dealer.name,
    businessName: dealer.businessName,
    phone: dealer.phone,
    verificationTier: dealer.verificationTier ?? 0,
  });
});
