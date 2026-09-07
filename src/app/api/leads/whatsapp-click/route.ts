import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { isFromAlert } from "@/lib/alerts/from-alert";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { Dealer } from "@/lib/db/models/Dealer";
import { Listing } from "@/lib/db/models/Listing";
import { Lead } from "@/lib/db/models/Lead";
import { findDuplicateLead } from "@/lib/leads/dedupe";
import { logAudit } from "@/lib/leads/assign";
import { SITE_URL, BRAND } from "@/lib/seo/site";

/**
 * POST /api/leads/whatsapp-click   [buyer auth]   { listingId? , dealerId?, source? }
 *
 * Tracks a "Contact on WhatsApp" click as a real, exclusive lead BEFORE opening
 * the chat. status "delivered" (the buyer reaches the dealer's WhatsApp directly,
 * so it is already "viewed" and has NO SLA — the SLA cron skips whatsapp_click).
 * Returns the wa.me URL with a prefilled message for the client to open.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    listingId: z.string().trim().optional(),
    dealerId: z.string().trim().optional(),
  })
  .refine((b) => Boolean(b.listingId) !== Boolean(b.dealerId), "Provide exactly one of listingId or dealerId.");

export const POST = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error; // 401 → client redirects to /login?next=

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fail("VALIDATION_ERROR", "A listing or dealer is required.");

  await connectDB();
  const user = await User.findById(auth.identity.userId, { name: 1, phone: 1 }).lean();
  if (!user?.phone) return fail("UNAUTHORIZED", "Please sign in again.");

  // Resolve the dealer, the WhatsApp target number, and the listing context.
  let dealerId: string | null = null;
  let listingId: string | null = null;
  let listingTitle = "";
  let listingSlug = "";
  if (parsed.data.listingId && mongoose.Types.ObjectId.isValid(parsed.data.listingId)) {
    const listing = await Listing.findById(parsed.data.listingId, {
      dealerId: 1,
      title: 1,
      slug: 1,
      status: 1,
    }).lean();
    if (!listing || listing.status !== "approved") return fail("NOT_FOUND", "Listing not available.");
    listingId = String(listing._id);
    dealerId = listing.dealerId ? String(listing.dealerId) : null;
    listingTitle = listing.title ?? "";
    listingSlug = listing.slug ?? "";
  } else if (parsed.data.dealerId && mongoose.Types.ObjectId.isValid(parsed.data.dealerId)) {
    dealerId = parsed.data.dealerId;
  }
  if (!dealerId) return fail("NOT_FOUND", "Dealer not found.");

  const dealer = await Dealer.findById(dealerId, {
    phone: 1,
    zenithNumber: 1,
    zenithConnected: 1,
    status: 1,
  }).lean();
  if (!dealer || dealer.status === "banned") return fail("NOT_FOUND", "Dealer not available.");
  const waNumber =
    dealer.zenithConnected && dealer.zenithNumber ? dealer.zenithNumber : dealer.phone;

  const text =
    `Hi, I'm ${user.name || "a buyer"} from ${BRAND}. ` +
    (listingTitle ? `I'm interested in "${listingTitle}"` : "I'd like to enquire about a property") +
    (listingSlug ? `:\n${SITE_URL}/property/${listingSlug}` : ".");
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;

  // Dedup (phone + dealer/listing, 24h) — never double-create or double-charge.
  const dup = await findDuplicateLead({
    phone: user.phone,
    listingId,
    dealerId: listingId ? null : dealerId,
  });
  if (dup) return ok({ waUrl, deduped: true });

  const now = new Date();
  const dealerOid = new mongoose.Types.ObjectId(dealerId);

  const lead = await Lead.create({
    phone: user.phone,
    name: user.name || undefined,
    source: "whatsapp_click",
    status: "new",
    ...(listingId ? { listingId: new mongoose.Types.ObjectId(listingId) } : {}),
    ...((await isFromAlert()) ? { fromAlert: true } : {}),
  });

  // Exclusive claim → status "delivered": already viewed (buyer reached out on
  // WhatsApp), deliveredAt set, NO slaDeadline (the SLA cron skips these).
  const claimed = await Lead.findOneAndUpdate(
    { _id: lead._id, assignedDealerId: null },
    {
      $set: {
        assignedDealerId: dealerOid,
        assignedAt: now,
        isLocked: true,
        status: "delivered",
        deliveredAt: now,
        viewedAt: now,
      },
      $push: {
        assignmentHistory: { dealerId: dealerOid, assignedAt: now, viewedAt: now, reason: "initial" },
      },
    },
    { new: true },
  );

  if (claimed) {
    // Same quota/lock accounting as any exclusive lead (no template — the buyer
    // is messaging the dealer directly).
    await Dealer.updateOne(
      { _id: dealerOid },
      { $inc: { leadsUsedThisMonth: 1, totalLeadsReceived: 1 }, $set: { lastAssignedAt: now } },
    );
    if (listingId) await Listing.updateOne({ _id: listingId }, { $inc: { leadCount: 1 } });
    await logAudit({
      action: "lead.auto-assign",
      actor: { actorType: "system", actorId: "whatsapp-click" },
      leadId: String(lead._id),
      dealerId,
      reason: "whatsapp click — delivered to dealer WhatsApp",
    });
  }

  return ok({ waUrl, leadId: String(lead._id) });
});
