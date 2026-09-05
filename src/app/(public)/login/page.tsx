import { Suspense } from "react";
import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { Logo } from "@/components/shared/logo";
import { EmailPasswordAuthForm } from "@/components/public/email-password-auth-form";
import { UserAuthForm } from "@/components/public/user-auth-form";
import { authMethod } from "@/lib/config/flags";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

// Reads the auth method + sets the buyer session cookie flow; never cache.
export const dynamic = "force-dynamic";

export default function BuyerLoginPage() {
  const method = authMethod();

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo />
          <div>
            <h1 className="text-display-sm">Sign in to continue</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {method === "password"
                ? "Create an account to contact dealers directly."
                : "Verify your number to contact dealers. No passwords."}
            </p>
          </div>
        </div>

        <div className="rounded-card border border-border bg-surface p-6 shadow-card">
          {/* useSearchParams (?next=, ?mode=) needs a Suspense boundary. */}
          <Suspense fallback={null}>
            {method === "whatsapp" ? (
              <UserAuthForm />
            ) : method === "sms" ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                SMS sign-in isn&apos;t available yet. Please check back soon.
              </p>
            ) : (
              <EmailPasswordAuthForm />
            )}
          </Suspense>
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-meta text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          We never share your number publicly. It goes only to the dealer you contact.
        </p>
      </div>
    </div>
  );
}
