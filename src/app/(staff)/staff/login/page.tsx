import { Suspense } from "react";
import type { Metadata } from "next";

import { Logo } from "@/components/shared/logo";
import { StaffLoginForm } from "@/components/staff/staff-login-form";

export const metadata: Metadata = {
  title: "Staff sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function StaffLoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo href="/" />
          <div>
            <h1 className="text-display-sm">Staff sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in with the email and password your admin set up for you.
            </p>
          </div>
        </div>

        <div className="rounded-card border border-border bg-surface p-6 shadow-card">
          <Suspense fallback={null}>
            <StaffLoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
