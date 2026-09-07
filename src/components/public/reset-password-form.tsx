"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Lock, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { hardNavigate, fetchWithTimeout, isTimeout } from "@/lib/auth/auth-nav";

/**
 * Reset-password: reads the single-use token + role from the URL, takes a new
 * password (with confirm), and posts to /api/auth/password/reset. On success the
 * server signs the user in and tells us where to go.
 */
export function ResetPasswordForm() {
  const search = useSearchParams();
  const token = search.get("token") ?? "";
  const role = search.get("role") === "dealer" ? "dealer" : "user";
  const backHref = role === "dealer" ? "/dealer/login" : "/login";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <AlertCircle className="size-10 text-danger-600" />
        <p className="font-semibold text-ink-950">Invalid reset link</p>
        <p className="text-sm text-muted-foreground">
          This link is missing its token. Request a new reset email.
        </p>
        <Link
          href={role === "dealer" ? "/forgot-password?role=dealer" : "/forgot-password"}
          className="mt-1 text-meta font-medium text-clay-700 hover:underline"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetchWithTimeout("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, role, password }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setError(body?.error?.message ?? "Could not reset your password. Try again.");
        return;
      }
      setDone(true);
      const redirect = typeof body.data?.redirect === "string" ? body.data.redirect : backHref;
      // HARD navigation — a password reset signs a fresh session; reload the
      // destination so it renders logged-in with no stale header.
      setTimeout(() => hardNavigate(redirect), 900);
    } catch (err) {
      setError(isTimeout(err) ? "The request timed out. Please try again." : "Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <CheckCircle2 className="size-10 text-success-600" />
        <p className="font-semibold text-ink-950">Password updated</p>
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rp-password" required>
          New password
        </Label>
        <PasswordInput
          icon={Lock}
          id="rp-password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rp-confirm" required>
          Confirm password
        </Label>
        <PasswordInput
          icon={Lock}
          id="rp-confirm"
          autoComplete="new-password"
          placeholder="Re-enter the password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>

      {error && <p className="text-meta text-danger-700">{error}</p>}

      <Button type="submit" disabled={busy} block>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
        Set new password
      </Button>
    </form>
  );
}
