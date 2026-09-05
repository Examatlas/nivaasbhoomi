import { Suspense } from "react";
import type { Metadata } from "next";

import { Logo } from "@/components/shared/logo";
import { LoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = {
  title: "Admin Login",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo href="/" />
          <div>
            <h1 className="text-display-sm">Admin</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to manage NivaasBhoomi.
            </p>
          </div>
        </div>

        <div className="rounded-card border border-border bg-surface p-6 shadow-card">
          {/* useSearchParams (for the ?next= param) needs a Suspense boundary. */}
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
