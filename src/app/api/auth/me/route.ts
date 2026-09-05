import { ok, withErrorHandling } from "@/lib/api/response";
import { getUserSession } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";

/**
 * GET /api/auth/me   (buyer)
 *
 * Lightweight "who am I" for the public site: the property "Contact Us" button
 * (rendered inside ISR/static pages) calls this on the client to decide whether
 * a click contacts the dealer directly or prompts sign-in. Returns only a
 * display name — never the phone or anything sensitive.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const session = await getUserSession();
  if (!session) return ok({ authed: false as const });

  await connectDB();
  const user = await User.findById(session.userId, { name: 1 }).lean();
  return ok({ authed: true as const, name: user?.name ?? null });
});
