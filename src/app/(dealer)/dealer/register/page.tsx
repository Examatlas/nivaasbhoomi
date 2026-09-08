import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getUserSession, getDealerSession } from "@/lib/auth/middleware";
import { verifySignupToken } from "@/lib/auth/signup-token";
import { SIGNUP_COOKIE } from "@/lib/auth/cookie";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { Dealer } from "@/lib/db/models/Dealer";
import { Logo } from "@/components/shared/logo";
import { DealerRegistrationForm } from "@/components/dealer/dealer-registration-form";

export const metadata: Metadata = {
  title: "Dealer registration",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Dealer registration — reached three ways (STEP 1):
 *   1. A logged-in BUYER becoming a dealer (/profile → become a dealer): a buyer
 *      session is present; submit to /api/users/me/upgrade (links the User).
 *   2. Dealer SELF-SIGNUP after OTP-verify: NO session yet, only a 15-minute
 *      verified-phone cookie; submit to /api/auth/dealer/complete-signup, which
 *      creates the User + Dealer together (orphan-User impossible).
 *   3. Already a dealer → straight to the dashboard.
 */
export default async function DealerRegisterPage() {
  await connectDB();

  // Path A (HIGHEST priority): a fresh dealer-OTP signup token. This wins over
  // any lingering session cookie, so a STALE cookie (an account that was since
  // deleted) can never bounce a freshly-verified dealer back to /dealer/login —
  // which was the bug: the browser kept a valid nb_user_session for a User that
  // no longer exists, and the buyer-branch redirected on User.findById → null.
  const token = await verifySignupToken((await cookies()).get(SIGNUP_COOKIE)?.value);
  if (token) {
    const existing = await User.findOne({ phone: token.phone }, { name: 1, dealerId: 1 }).lean();
    // Already a REAL dealer on this number → dashboard (ignore a stale link).
    if (existing?.dealerId && (await Dealer.exists({ _id: existing.dealerId }))) {
      redirect("/dealer/dashboard");
    }
    const mode = existing ? "upgrade" : "new";
    return (
      <Shell>
        <DealerRegistrationForm
          name={existing?.name ?? ""}
          phone={token.phone}
          mode={mode}
          submitPath="/api/auth/dealer/complete-signup"
        />
      </Shell>
    );
  }

  // Path B: no signup token → session-based (the /profile → "become a dealer"
  // upgrade for a logged-in buyer). A session cookie is honored ONLY when its
  // account still EXISTS; a stale cookie is ignored (fall through), never a
  // redirect-loop.
  const dealerSession = await getDealerSession();
  if (dealerSession && (await Dealer.exists({ _id: dealerSession.dealerId }))) {
    redirect("/dealer/dashboard");
  }

  const session = await getUserSession();
  if (session) {
    const user = await User.findById(session.userId, { name: 1, phone: 1, dealerId: 1 }).lean();
    if (user) {
      if (user.dealerId) redirect("/dealer/dashboard");
      return (
        <Shell>
          <DealerRegistrationForm
            name={user.name ?? ""}
            phone={user.phone ?? ""}
            mode="upgrade"
            submitPath="/api/users/me/upgrade"
          />
        </Shell>
      );
    }
    // stale/deleted buyer session → ignored; fall through to login.
  }

  redirect("/dealer/login");
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Logo href="/" />
      </div>
      {children}
    </div>
  );
}
