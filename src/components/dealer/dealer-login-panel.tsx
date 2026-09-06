"use client";

import { useState } from "react";
import { KeyRound, MessageCircle } from "lucide-react";

import { OtpLoginForm } from "@/components/auth/otp-login-form";
import { DealerAuthForm } from "@/components/dealer/dealer-auth-form";

/**
 * Dealer sign-in: WhatsApp OTP is primary (default view). A divider + link
 * toggles to the existing email+password form on the SAME page (no separate
 * route); that form carries its own "Forgot password?" and password-visibility
 * toggle, and links back to the WhatsApp flow. Password is the fallback if
 * WhatsApp is unavailable.
 */
export function DealerLoginPanel() {
  const [view, setView] = useState<"otp" | "password">("otp");

  if (view === "password") {
    return (
      <div className="flex flex-col gap-5">
        <DealerAuthForm />
        <div className="border-t border-border pt-4 text-center">
          <button
            type="button"
            onClick={() => setView("otp")}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-clay-700 hover:underline"
          >
            <MessageCircle className="size-4" /> Login with WhatsApp instead
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <OtpLoginForm role="dealer" />

      <div className="flex items-center gap-3 text-meta text-subtle-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <button
        type="button"
        onClick={() => setView("password")}
        className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-clay-700 hover:underline"
      >
        <KeyRound className="size-4" /> Login with email &amp; password
      </button>
    </div>
  );
}
