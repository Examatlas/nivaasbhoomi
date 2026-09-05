import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Clock } from "lucide-react";

import { Logo } from "@/components/shared/logo";
import { OtpLoginForm } from "@/components/dealer/otp-login-form";
import { DealerAuthForm } from "@/components/dealer/dealer-auth-form";
import { dealerLoginEnabled, authMethod } from "@/lib/config/flags";

export const metadata: Metadata = {
  title: "Dealer Login",
  robots: { index: false, follow: false },
};

// Dynamic, never cached (Section 9: /dealer/* dynamic, no cache).
export const dynamic = "force-dynamic";

export default function DealerLoginPage() {
  const enabled = dealerLoginEnabled();
  const method = authMethod();

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo href="/" />
          <div>
            <h1 className="text-display-sm">Dealer sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              List and manage your property on NivaasBhoomi.
            </p>
          </div>
        </div>

        <div className="rounded-card border border-border bg-surface p-6 shadow-card">
          {!enabled ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <Clock className="size-10 text-clay-500" />
              <p className="font-semibold text-ink-950">Dealer sign-in is coming soon</p>
              <p className="text-sm text-muted-foreground">
                We&apos;re onboarding dealers shortly. Want to list your property in the
                meantime? Get in touch and our team will set you up.
              </p>
              <Link
                href="/"
                className="mt-1 inline-flex items-center rounded-control bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
              >
                Back to home
              </Link>
            </div>
          ) : (
            // useSearchParams (?next=, ?mode=) needs a Suspense boundary.
            <Suspense fallback={null}>
              {method === "whatsapp" ? <OtpLoginForm /> : <DealerAuthForm />}
            </Suspense>
          )}
        </div>

        {enabled && (
          <p className="mt-6 text-center text-meta text-muted-foreground">
            By continuing you agree to our terms. We never share your number.
          </p>
        )}
      </div>
    </div>
  );
}
