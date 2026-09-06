import { ok, withErrorHandling } from "@/lib/api/response";
import { getUserSession } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";

/**
 * GET /api/auth/me   (buyer session)
 *
 * The public site is ISR/static, so the header, the property "Contact Us"
 * button and the profile-completion prompt all call this on the CLIENT to learn
 * the buyer's login state without making pages dynamic. Buyer-scoped: it reads
 * only the buyer cookie. Returns the buyer's OWN details (safe — it is their
 * own authenticated session).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const session = await getUserSession();
  if (!session) return ok({ authed: false as const });

  await connectDB();
  const user = await User.findById(session.userId, {
    name: 1,
    email: 1,
    phone: 1,
    dealerId: 1,
  }).lean();
  if (!user) return ok({ authed: false as const });

  return ok({
    authed: true as const,
    role: "buyer" as const,
    id: session.userId,
    name: user.name ?? null,
    email: user.email ?? null,
    phone: user.phone ?? null,
    dealerId: user.dealerId ? String(user.dealerId) : null,
    profileComplete: Boolean(user.name),
  });
});
