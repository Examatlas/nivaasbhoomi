import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getUserSession } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { BecomeDealerFlow } from "@/components/public/become-dealer-flow";

export const metadata: Metadata = {
  title: "Become a dealer",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function BecomeDealerPage() {
  const session = await getUserSession();
  if (!session) redirect("/login?next=/become-dealer");

  await connectDB();
  const user = await User.findById(session.userId, { name: 1, phone: 1, dealerId: 1 }).lean();
  if (!user) redirect("/login");
  // Already a dealer → straight to the dashboard.
  if (user.dealerId) redirect("/dealer/dashboard");

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <BecomeDealerFlow name={user.name ?? ""} phone={user.phone ?? ""} />
    </div>
  );
}
