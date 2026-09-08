import mongoose from "mongoose";
import { z } from "zod";

import type { ApiErrorCode } from "@/lib/api/response";
import { connectDB } from "@/lib/db/connect";
import { City } from "@/lib/db/models/City";
import { Dealer } from "@/lib/db/models/Dealer";
import { User } from "@/lib/db/models/User";
import { DealerSignupLog } from "@/lib/db/models/DealerSignupLog";
import { DEFAULT_MONTHLY_QUOTA } from "@/lib/leads/quota-config";
import { dealerSignupStatus } from "@/lib/config/flags";
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
 * Shared dealer-registration logic (STEP 1). ONE place that turns a
 * verified-phone identity into a "pending" Dealer, so all entry points agree:
 *   - buyer→dealer upgrade (session)         → registerDealerForUser()
 *   - dealer self-signup, existing number     → registerDealerForUser()
 *   - dealer self-signup, brand-new number    → createUserAndDealer() [atomic]
 *
 * Orphan-User fix: the new-number path creates the User AND Dealer inside one
 * transaction, and only AFTER all validation passes — so an abandoned or failed
 * form persists nothing.
 */

const objectId = (label: string) =>
  z.string().refine((v) => mongoose.Types.ObjectId.isValid(v), `Invalid ${label}`);

export const dealerRegistrationSchema = z.object({
  // Dealer's own name. Collected on the form (new dealers have no account yet);
  // optional server-side so a bad value can't 500, validated on the client.
  name: z.string().trim().max(120).optional(),
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

export type DealerRegistrationInput = z.infer<typeof dealerRegistrationSchema>;

export interface RegistrableUser {
  _id: unknown;
  phone?: string | null;
  name?: string | null;
  dealerId?: unknown;
}

interface Failure {
  ok: false;
  code: ApiErrorCode;
  message: string;
  details?: unknown;
}

export type RegisterResult =
  | { ok: true; dealerId: string; status: string; linked: boolean; created: boolean; alreadyDealer: boolean }
  | Failure;

export type CreateResult =
  | { ok: true; userId: string; dealerId: string; status: string; linked: boolean }
  | Failure;

/** Built, validated fields ready to become a Dealer document. */
interface PreparedDealer {
  cityOids: mongoose.Types.ObjectId[];
  localityOids: mongoose.Types.ObjectId[];
  documents: Record<string, unknown>;
  isDuplicate: boolean;
}

/** Reads-only validation + field build. No writes, so it can run BEFORE any User
 *  is created (the guarantee that a failed form never persists anything). */
async function prepareDealerCreate(
  input: DealerRegistrationInput,
  ip: string,
): Promise<{ ok: true; prepared: PreparedDealer } | Failure> {
  if (input.businessName.trim().length < 2 || input.coverageCities.length === 0) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Business name and at least one coverage city are required.",
    };
  }
  for (const [kind, val] of [
    ["gst", input.gstNumber],
    ["udyam", input.udyamNumber],
    ["rera", input.reraNumber],
  ] as const) {
    if (val) {
      const msg = validateRegId(kind, val);
      if (msg) return { ok: false, code: "VALIDATION_ERROR", message: msg };
    }
  }
  const cityCount = await City.countDocuments({ _id: { $in: input.coverageCities } });
  if (cityCount !== new Set(input.coverageCities).size) {
    return { ok: false, code: "VALIDATION_ERROR", message: "One or more coverage cities are invalid." };
  }
  const ipCount = await DealerSignupLog.countDocuments({
    ip,
    createdAt: { $gte: new Date(Date.now() - SIGNUP_RATE_WINDOW_SECONDS * 1000) },
  });
  const rate = signupRateLimitDecision(ipCount);
  if (!rate.allowed) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many signups from this network. Please try again later.",
      details: { retryAfter: rate.retryAfter },
    };
  }
  const cityOids = input.coverageCities.map((c) => new mongoose.Types.ObjectId(c));
  const dupCandidates = await Dealer.find(
    { coverageCities: { $in: cityOids } },
    { businessName: 1, coverageCities: 1 },
  ).lean();
  const isDuplicate = isDuplicateSignup(
    { businessName: input.businessName, cities: input.coverageCities },
    dupCandidates.map((d) => ({
      businessName: d.businessName,
      cities: (d.coverageCities ?? []).map(String),
    })),
  );
  const documents: Record<string, unknown> = {};
  if (input.gstNumber) documents.gst = { number: normalizeRegId(input.gstNumber), verified: false };
  if (input.udyamNumber) documents.udyam = { number: normalizeRegId(input.udyamNumber), verified: false };
  if (input.reraNumber) documents.rera = { number: normalizeRegId(input.reraNumber), verified: false };
  return {
    ok: true,
    prepared: {
      cityOids,
      localityOids: input.coverageLocalities.map((l) => new mongoose.Types.ObjectId(l)),
      documents,
      isDuplicate,
    },
  };
}

/** The Dealer.create payload for a prepared, validated registration. */
function dealerDoc(
  input: DealerRegistrationInput,
  prepared: PreparedDealer,
  userId: mongoose.Types.ObjectId,
  phone: string,
  name: string | null,
) {
  return {
    name: name || input.businessName,
    businessName: input.businessName,
    phone,
    phoneVerified: true,
    userId,
    // active by default (tier 0 keeps listings private until verified); the flag
    // can put it back to "pending" for an approval gate — see dealerSignupStatus.
    status: dealerSignupStatus(),
    maxLeadsPerMonth: DEFAULT_MONTHLY_QUOTA,
    dealTypes: input.dealTypes,
    coverageCities: prepared.cityOids,
    coverageLocalities: prepared.localityOids,
    ...(prepared.isDuplicate
      ? { duplicateFlagged: true, duplicateReason: "Same business name in an overlapping coverage city." }
      : {}),
    ...(Object.keys(prepared.documents).length ? { documents: prepared.documents } : {}),
  };
}

async function notifyAdmin(businessName: string, name: string | null | undefined, phone: string, dealerId: string, isDuplicate: boolean) {
  const adminTo = process.env.ADMIN_EMAIL || COMPANY.email;
  const dupNote = isDuplicate
    ? " ⚠ Flagged: same business name in an overlapping coverage city — review for a possible duplicate."
    : "";
  await sendEmail({
    to: adminTo,
    subject: `[${BRAND}] New dealer signed up: ${businessName}`,
    text:
      `A new dealer signed up (Tier 0 — their listings stay private until you verify their documents).\n\n` +
      `Business: ${businessName}\nName: ${name || "—"}\nPhone: +${phone}\n` +
      `Dealer id: ${dealerId}\n${dupNote ? `\n${dupNote}\n` : ""}\n` +
      `Verify them in the admin panel → Dealers (filter: Needs verification).`,
    html:
      `<p>A new dealer signed up (Tier 0 — their listings stay private until you verify their documents).</p>` +
      `<p>Business: <strong>${businessName}</strong><br/>Name: ${name || "—"}<br/>Phone: +${phone}<br/>Dealer id: ${dealerId}</p>` +
      (dupNote ? `<p style="color:#b45309">${dupNote}</p>` : "") +
      `<p>Verify them in the admin panel → Dealers (filter: Needs verification).</p>`,
  }).catch(() => {});
}

/**
 * Existing-User path (buyer→dealer upgrade, or a self-signup on a number that
 * already has a User). No transaction needed — the User is already persisted, so
 * there is no orphan to create.
 */
export async function registerDealerForUser(
  user: RegistrableUser,
  input: DealerRegistrationInput,
  ip: string,
): Promise<RegisterResult> {
  await connectDB();
  const userId = String(user._id);

  if (user.dealerId) {
    return { ok: true, dealerId: String(user.dealerId), status: "", linked: false, created: false, alreadyDealer: true };
  }

  // A manual dealer already exists on this phone → LINK, don't duplicate (this
  // runs before reading the form, so a minimal form still links).
  const existing = await Dealer.findOne({ phone: user.phone });
  if (existing) {
    if (existing.userId && String(existing.userId) !== userId) {
      return { ok: false, code: "DUPLICATE", message: "A dealer account already exists for this number." };
    }
    existing.userId = new mongoose.Types.ObjectId(userId);
    await existing.save();
    await User.updateOne({ _id: userId }, { $set: { dealerId: existing._id } });
    return { ok: true, dealerId: String(existing._id), status: String(existing.status ?? "pending"), linked: true, created: false, alreadyDealer: false };
  }

  const prep = await prepareDealerCreate(input, ip);
  if (!prep.ok) return prep;

  const dealer = await Dealer.create(
    dealerDoc(input, prep.prepared, new mongoose.Types.ObjectId(userId), user.phone ?? "", user.name ?? null),
  );
  await DealerSignupLog.create({ ip });
  await User.updateOne({ _id: userId }, { $set: { dealerId: dealer._id } });
  await notifyAdmin(input.businessName, user.name, user.phone ?? "", String(dealer._id), prep.prepared.isDuplicate);

  return { ok: true, dealerId: String(dealer._id), status: dealerSignupStatus(), linked: false, created: true, alreadyDealer: false };
}

/**
 * Brand-new number path (dealer self-signup, no User yet). Creates the User AND
 * Dealer inside ONE transaction, only after all validation passes — so a failed
 * or abandoned form leaves NOTHING behind (orphan-User impossible).
 */
export async function createUserAndDealer(
  phone: string,
  name: string | null,
  input: DealerRegistrationInput,
  ip: string,
): Promise<CreateResult> {
  await connectDB();

  // Defensive: a manual dealer may already sit on this phone (OTP-verify normally
  // diverts these to the dashboard). Link a fresh User to it rather than duplicate.
  const existingDealer = await Dealer.findOne({ phone });
  if (existingDealer) {
    if (existingDealer.userId) {
      return { ok: false, code: "DUPLICATE", message: "A dealer account already exists for this number." };
    }
    const session = await mongoose.startSession();
    try {
      let userId = "";
      await session.withTransaction(async () => {
        const created = await User.create([{ phone, phoneVerified: true, name, lastLoginAt: new Date() }], { session });
        const u = created[0]!;
        existingDealer.userId = u._id as mongoose.Types.ObjectId;
        await existingDealer.save({ session });
        await User.updateOne({ _id: u._id }, { $set: { dealerId: existingDealer._id } }, { session });
        userId = String(u._id);
      });
      return { ok: true, userId, dealerId: String(existingDealer._id), status: String(existingDealer.status ?? "pending"), linked: true };
    } finally {
      await session.endSession();
    }
  }

  const prep = await prepareDealerCreate(input, ip);
  if (!prep.ok) return prep;

  const session = await mongoose.startSession();
  try {
    let userId = "";
    let dealerId = "";
    await session.withTransaction(async () => {
      const createdUsers = await User.create([{ phone, phoneVerified: true, name, lastLoginAt: new Date() }], { session });
      const u = createdUsers[0]!;
      const createdDealers = await Dealer.create(
        [dealerDoc(input, prep.prepared, u._id as mongoose.Types.ObjectId, phone, name)],
        { session },
      );
      const d = createdDealers[0]!;
      await User.updateOne({ _id: u._id }, { $set: { dealerId: d._id } }, { session });
      userId = String(u._id);
      dealerId = String(d._id);
    });
    // After commit: best-effort side effects.
    await DealerSignupLog.create({ ip });
    await notifyAdmin(input.businessName, name, phone, dealerId, prep.prepared.isDuplicate);
    return { ok: true, userId, dealerId, status: dealerSignupStatus(), linked: false };
  } finally {
    await session.endSession();
  }
}
