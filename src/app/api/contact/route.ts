import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { createEnquiry } from "@/lib/leads/enquiry";

/**
 * POST /api/contact   (buyer auth required — the gated "Contact Us" action)
 *   body: { listingId, message? }
 *
 * A signed-in buyer taps "Contact Us" on a listing. We create a Lead (carrying
 * the listing Ref) and route it to that listing's dealer, so it lands in the
 * dealer's dashboard → Leads. The dealer then contacts the buyer directly.
 *
 * SECURITY: the buyer's phone + name come ONLY from the verified session's User
 * record — never from the request body — so a lead can't be spoofed onto
 * someone else's number.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  listingId: z.string().trim().min(1),
  message: z.string().trim().max(1000).optional(),
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
    return fail("VALIDATION_ERROR", "A listing is required.");
  }

  await connectDB();
  const user = await User.findById(auth.identity.userId, {
    phone: 1,
    name: 1,
    waProfileName: 1,
  }).lean();
  if (!user) {
    return fail("UNAUTHORIZED", "Your session has expired. Please sign in again.");
  }

  const result = await createEnquiry({
    name: user.name || user.waProfileName || "NivaasBhoomi buyer",
    phone: user.phone,
    listingId: parsed.data.listingId,
    message: parsed.data.message,
  });

  return ok({ received: true, leadId: result.leadId });
});
