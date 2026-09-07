import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getUserSession } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { Logo } from "@/components/shared/logo";
import { DealerRegistrationForm } from "@/components/dealer/dealer-registration-form";

export const metadata: Metadata = {
  title: "Dealer registration",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Dealer self-signup — reached after a verified WhatsApp OTP finds no dealer on
 * the number (the OTP verify route creates/links the underlying User and sets a
 * buyer session, then sends the browser here). Renders the SHARED registration
 * form; submitting creates a "pending" Dealer awaiting admin approval.
 */
export default async function DealerRegisterPage({ searchParams }: PageProps<"/dealer/register">) {
  const session = await getUserSession();
  if (!session) redirect("/dealer/login");

  await connectDB();
  const user = await User.findById(session.userId, { name: 1, phone: 1, dealerId: 1 }).lean();
  if (!user) redirect("/dealer/login");
  // Already a dealer → straight to the dashboard.
  if (user.dealerId) redirect("/dealer/dashboard");

  const sp = await searchParams;
  const mode = sp.mode === "upgrade" ? "upgrade" : "new";

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Logo href="/" />
        <p className="text-sm text-muted-foreground">
          Your number is verified. Tell us about your business to finish setting up.
        </p>
      </div>
      <DealerRegistrationForm name={user.name ?? ""} phone={user.phone ?? ""} mode={mode} />
    </div>
  );
}
