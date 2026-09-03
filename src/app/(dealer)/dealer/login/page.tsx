import { Suspense } from "react";
import type { Metadata } from "next";

import { Logo } from "@/components/shared/logo";
import { OtpLoginForm } from "@/components/dealer/otp-login-form";

export const metadata: Metadata = {
  title: "Dealer Login",
  robots: { index: false, follow: false },
};

// Dynamic, never cached (Section 9: /dealer/* dynamic, no cache).
export const dynamic = "force-dynamic";

export default function DealerLoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo />
          <div>
            <h1 className="text-display-sm">Dealer sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              List and manage your property on NivaasBhoomi.
            </p>
          </div>
        </div>

        <div className="rounded-card border border-border bg-surface p-6 shadow-card">
          {/* useSearchParams (?next=) needs a Suspense boundary. */}
          <Suspense fallback={null}>
            <OtpLoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-meta text-muted-foreground">
          By continuing you agree to our terms. We never share your number.
        </p>
      </div>
    </div>
  );
}
