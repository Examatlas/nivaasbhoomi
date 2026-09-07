import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/middleware";
import { signSession } from "@/lib/auth/jwt";
import { DEALER_COOKIE, USER_COOKIE, sessionCookieOptions } from "@/lib/auth/cookie";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { Dealer } from "@/lib/db/models/Dealer";
import { DealerSignupLog } from "@/lib/db/models/DealerSignupLog";
import { City } from "@/lib/db/models/City";
import { validateRegId, normalizeRegId } from "@/lib/validation/registration-ids";
import {
  signupRateLimitDecision,
  isDuplicateSignup,
  SIGNUP_RATE_WINDOW_SECONDS,
} from "@/lib/dealers/signup";
import { sendEmail } from "@/lib/email/mailer";
import { COMPANY } from "@/lib/legal/company";
import { BRAND } from "@/lib/seo/site";

/**
 * POST /api/users/me/upgrade   [buyer auth]
 *
 * A logged-in buyer becomes a dealer. If a Dealer already exists on their phone
 * WITHOUT a userId (a manually-created dealer), the two are LINKED — never
 * duplicated. Otherwise a new Dealer is created with status "pending" (excluded
 * from lead routing + blocked from listings until an admin approves). Both sides
 * are linked, the dealer session cookie is set (one login, both panels), and an
 * admin is emailed.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const objectId = (label: string) =>
  z.string().refine((v) => mongoose.Types.ObjectId.isValid(v), `Invalid ${label}`);

const bodySchema = z.object({
  businessName: z.string().trim().min(2).max(160),
  dealTypes: z
    .array(z.enum(["plot", "flat", "house", "commercial", "rent", "resale"]))
    .max(6)
    .default([]),
  coverageCities: z.array(objectId("cityId")).min(1).max(100),
  coverageLocalities: z.array(objectId("localityId")).max(500).default([]),
  gstNumber: z.string().trim().max(40).optional(),
  udyamNumber: z.string().trim().max(40).optional(),
  reraNumber: z.string().trim().max(40).optional(),
});

async function setDealerCookie(userId: string, dealerId: string): Promise<void> {
  const store = await cookies();
  // Refresh the buyer session to carry dealerId, and set the dealer session too.
  const userToken = await signSession({ role: "user", userId, dealerId });
  store.set(USER_COOKIE, userToken, sessionCookieOptions());
  const dealerToken = await signSession({ role: "dealer", dealerId });
  store.set(DEALER_COOKIE, dealerToken, sessionCookieOptions());
}

export const POST = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const userId = auth.identity.userId;

  await connectDB();
  const user = await User.findById(userId);
  if (!user) return fail("NOT_FOUND", "Account not found.");

  // Already a dealer → straight through.
  if (user.dealerId) {
    await setDealerCookie(userId, String(user.dealerId));
    return ok({ dealerId: String(user.dealerId), alreadyDealer: true });
  }

  // A manual dealer already exists on this phone → LINK, don't duplicate.
  const existing = await Dealer.findOne({ phone: user.phone });
  if (existing) {
    if (existing.userId && String(existing.userId) !== userId) {
      return fail("DUPLICATE", "A dealer account already exists for this number.");
    }
    existing.userId = new mongoose.Types.ObjectId(userId);
    await existing.save();
    user.dealerId = existing._id;
    await user.save();
    await setDealerCookie(userId, String(existing._id));
    return ok({ dealerId: String(existing._id), linked: true, status: existing.status });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Please check the form.", parsed.error.flatten());
  const b = parsed.data;

  // Validate the reg-ids (all optional) and coverage cities exist.
  for (const [kind, val] of [
    ["gst", b.gstNumber],
    ["udyam", b.udyamNumber],
    ["rera", b.reraNumber],
  ] as const) {
    if (val) {
      const msg = validateRegId(kind, val);
      if (msg) return fail("VALIDATION_ERROR", msg);
    }
  }
  const cityCount = await City.countDocuments({ _id: { $in: b.coverageCities } });
  if (cityCount !== new Set(b.coverageCities).size) {
    return fail("VALIDATION_ERROR", "One or more coverage cities are invalid.");
  }

  // Anti-spam: cap dealer creations at 3/hour/IP (a TTL log windows the count).
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const ipCount = await DealerSignupLog.countDocuments({
    ip,
    createdAt: { $gte: new Date(Date.now() - SIGNUP_RATE_WINDOW_SECONDS * 1000) },
  });
  const rate = signupRateLimitDecision(ipCount);
  if (!rate.allowed) {
    return fail("RATE_LIMITED", "Too many signups from this network. Please try again later.", {
      retryAfter: rate.retryAfter,
    });
  }

  // Flag (never block) an exact business-name duplicate in an overlapping city.
  const cityOids = b.coverageCities.map((c) => new mongoose.Types.ObjectId(c));
  const dupCandidates = await Dealer.find(
    { coverageCities: { $in: cityOids } },
    { businessName: 1, coverageCities: 1 },
  ).lean();
  const isDuplicate = isDuplicateSignup(
    { businessName: b.businessName, cities: b.coverageCities },
    dupCandidates.map((d) => ({
      businessName: d.businessName,
      cities: (d.coverageCities ?? []).map(String),
    })),
  );

  const documents: Record<string, unknown> = {};
  if (b.gstNumber) documents.gst = { number: normalizeRegId(b.gstNumber), verified: false };
  if (b.udyamNumber) documents.udyam = { number: normalizeRegId(b.udyamNumber), verified: false };
  if (b.reraNumber) documents.rera = { number: normalizeRegId(b.reraNumber), verified: false };

  const dealer = await Dealer.create({
    name: user.name || b.businessName,
    businessName: b.businessName,
    phone: user.phone,
    phoneVerified: true,
    userId: new mongoose.Types.ObjectId(userId),
    status: "pending",
    dealTypes: b.dealTypes,
    coverageCities: cityOids,
    coverageLocalities: b.coverageLocalities.map((l) => new mongoose.Types.ObjectId(l)),
    ...(isDuplicate
      ? {
          duplicateFlagged: true,
          duplicateReason: "Same business name in an overlapping coverage city.",
        }
      : {}),
    ...(Object.keys(documents).length ? { documents } : {}),
  });
  await DealerSignupLog.create({ ip });
  user.dealerId = dealer._id;
  await user.save();
  await setDealerCookie(userId, String(dealer._id));

  // Notify an admin (best-effort).
  const adminTo = process.env.ADMIN_EMAIL || COMPANY.email;
  const dupNote = isDuplicate
    ? " ⚠ Flagged: same business name in an overlapping coverage city — review for a possible duplicate."
    : "";
  await sendEmail({
    to: adminTo,
    subject: `[${BRAND}] New dealer pending approval: ${b.businessName}`,
    text:
      `A new dealer signed up and is awaiting approval.\n\n` +
      `Business: ${b.businessName}\nName: ${user.name || "—"}\nPhone: +${user.phone}\n` +
      `Dealer id: ${String(dealer._id)}\n${dupNote ? `\n${dupNote}\n` : ""}\n` +
      `Approve in the admin panel → Dealers.`,
    html:
      `<p>A new dealer signed up and is awaiting approval.</p>` +
      `<p>Business: <strong>${b.businessName}</strong><br/>Name: ${user.name || "—"}<br/>Phone: +${user.phone}<br/>Dealer id: ${String(dealer._id)}</p>` +
      (dupNote ? `<p style="color:#b45309">${dupNote}</p>` : "") +
      `<p>Approve in the admin panel → Dealers.</p>`,
  }).catch(() => {});

  return ok({ dealerId: String(dealer._id), created: true, status: "pending" });
});
