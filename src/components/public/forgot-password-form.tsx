"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Forgot-password: enter the account email, we email a reset link. Always shows
 * a generic confirmation (never reveals whether the email is registered). `role`
 * (buyer vs dealer) comes from the query so the right account space is searched.
 * In development, if email isn't configured the API returns the link and we show
 * it so recovery is testable.
 */
export function ForgotPasswordForm() {
  const search = useSearchParams();
  const role = search.get("role") === "dealer" ? "dealer" : "user";
  const backHref = role === "dealer" ? "/dealer/login" : "/login";

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/password/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setError(body?.error?.message ?? "Something went wrong. Please try again.");
        return;
      }
      if (body.data?.devResetLink) setDevLink(body.data.devResetLink);
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <CheckCircle2 className="size-10 text-success-600" />
        <p className="font-semibold text-ink-950">Check your email</p>
        <p className="text-sm text-muted-foreground">
          If an account exists for <span className="font-medium">{email}</span>, we&apos;ve
          sent a link to reset your password. It expires in 1 hour.
        </p>
        {devLink && (
          <p className="w-full break-all rounded-control border border-warning-100 bg-warning-50 px-3 py-2 text-left text-meta text-warning-700">
            Dev mode (email not configured): open{" "}
            <Link href={devLink.replace(/^https?:\/\/[^/]+/, "")} className="font-medium underline">
              your reset link
            </Link>
            .
          </p>
        )}
        <Link href={backHref} className="mt-1 text-meta font-medium text-clay-700 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fp-email" required>
          Account email
        </Label>
        <div className="relative">
          <Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="fp-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-9"
            required
          />
        </div>
      </div>

      {error && <p className="text-meta text-danger-700">{error}</p>}

      <Button type="submit" disabled={busy} block>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
        Email me a reset link
      </Button>

      <Link href={backHref} className="text-center text-meta font-medium text-clay-700 hover:underline">
        Back to sign in
      </Link>
    </form>
  );
}
