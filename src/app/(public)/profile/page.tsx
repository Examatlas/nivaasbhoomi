import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getUserSession } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { BuyerProfileForm } from "@/components/public/buyer-profile-form";

export const metadata: Metadata = {
  title: "My Profile",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function BuyerProfilePage() {
  const session = await getUserSession();
  if (!session) redirect("/login?next=/profile");

  await connectDB();
  const user = await User.findById(session.userId, { name: 1, email: 1, phone: 1 }).lean();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <h1 className="text-display-sm">My profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your account details on NivaasBhoomi.
      </p>
      <BuyerProfileForm
        initial={{
          name: user.name ?? "",
          email: user.email ?? "",
          phone: user.phone ?? "",
        }}
      />
    </div>
  );
}
