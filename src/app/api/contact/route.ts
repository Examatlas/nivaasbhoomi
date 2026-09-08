import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { createEnquiry, createAgentProfileEnquiry } from "@/lib/leads/enquiry";
import { isFromAlert } from "@/lib/alerts/from-alert";
import { isSeedListing, SEED_CONTACT_BLOCKED_MESSAGE } from "@/lib/listings/seed";

/**
 * POST /api/contact   (buyer auth required — the gated "Contact Us" action)
 *   body: { listingId, message? }   -> lead routed to the listing's dealer
 *   body: { dealerId, message? }    -> lead assigned DIRECTLY to that dealer
 *                                      (from their public /agent profile)
 *
 * A signed-in buyer taps "Contact Us". We create a Lead and route it to the
 * dealer, so it lands in their dashboard → Leads. Exactly one of listingId /
 * dealerId is required.
 *
 * SECURITY: the buyer's phone + name come ONLY from the verified session's User
 * record — never from the request body — so a lead can't be spoofed onto
 * someone else's number.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    listingId: z.string().trim().min(1).optional(),
    dealerId: z.string().trim().min(1).optional(),
    message: z.string().trim().max(1000).optional(),
  })
  .refine((b) => Boolean(b.listingId) !== Boolean(b.dealerId), {
    message: "Provide exactly one of listingId or dealerId.",
  });

export const POST = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "A listing or dealer is required.");
  }

  await connectDB();

  // Seed (display-only) listings can never be contacted — block server-side.
  if (parsed.data.listingId && (await isSeedListing(parsed.data.listingId))) {
    return fail("VALIDATION_ERROR", SEED_CONTACT_BLOCKED_MESSAGE);
  }

  const user = await User.findById(auth.identity.userId, {
    phone: 1,
    name: 1,
    waProfileName: 1,
  }).lean();
  if (!user) {
    return fail("UNAUTHORIZED", "Your session has expired. Please sign in again.");
  }

  const name = user.name || user.waProfileName || "NivaasBhoomi buyer";
  const fromAlert = await isFromAlert();
  const result = parsed.data.dealerId
    ? await createAgentProfileEnquiry({
        dealerId: parsed.data.dealerId,
        name,
        phone: user.phone,
        message: parsed.data.message,
        fromAlert,
      })
    : await createEnquiry({
        name,
        phone: user.phone,
        listingId: parsed.data.listingId,
        message: parsed.data.message,
        fromAlert,
      });

  return ok({ received: true, leadId: result.leadId });
});
