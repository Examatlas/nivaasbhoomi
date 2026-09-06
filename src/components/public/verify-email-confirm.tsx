"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/lib/api/client";

/**
 * Confirms a dealer email change. The token (from the emailed link) is the
 * authorization — no sign-in required. We use an explicit button rather than
 * auto-confirming on load, so email-scanner prefetches can't silently consume
 * the single-use token.
 */
export function VerifyEmailConfirm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">(
    token ? "idle" : "error",
  );
  const [error, setError] = useState<string | null>(
    token ? null : "This link is missing its token. Request a new one from your profile.",
  );
  const [email, setEmail] = useState<string | null>(null);

  async function confirm() {
    setState("busy");
    setError(null);
    try {
      const res = await apiFetch<{ email: string }>("/api/dealers/email/verify", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      setEmail(res.email);
      setState("done");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not confirm this change.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="size-10 text-success-600" />
        <p className="font-semibold text-ink-950">Email confirmed</p>
        <p className="text-sm text-muted-foreground">
          Your account email is now <span className="font-medium">{email}</span>.
        </p>
        <Link href="/dealer/profile" className="mt-1 text-meta font-medium text-clay-700 hover:underline">
          Back to your profile
        </Link>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertCircle className="size-10 text-danger-600" />
        <p className="font-semibold text-ink-950">Couldn&apos;t confirm</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Link href="/dealer/profile" className="mt-1 text-meta font-medium text-clay-700 hover:underline">
          Back to your profile
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-clay-50 text-clay-700">
        <Mail className="size-6" />
      </span>
      <div>
        <p className="font-semibold text-ink-950">Confirm your new email</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Click below to set this address as your account email.
        </p>
      </div>
      <Button onClick={confirm} disabled={state === "busy"} size="lg" block>
        {state === "busy" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
        Confirm email change
      </Button>
    </div>
  );
}
