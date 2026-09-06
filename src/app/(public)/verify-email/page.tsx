import type { Metadata } from "next";

import { VerifyEmailConfirm } from "@/components/public/verify-email-confirm";

export const metadata: Metadata = {
  title: "Confirm your email",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default function VerifyEmailPage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-card border border-border bg-surface p-6 shadow-card">
        <VerifyEmailConfirm />
      </div>
    </main>
  );
}
