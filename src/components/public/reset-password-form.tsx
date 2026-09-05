"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Reset-password: reads the single-use token + role from the URL, takes a new
 * password (with confirm), and posts to /api/auth/password/reset. On success the
 * server signs the user in and tells us where to go.
 */
export function ResetPasswordForm() {
  const router = useRouter();
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
      const res = await fetch("/api/auth/password/reset", {
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
      setTimeout(() => {
        router.replace(redirect);
        router.refresh();
      }, 900);
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
        <div className="relative">
          <Lock className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="rp-password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-9"
            required
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rp-confirm" required>
          Confirm password
        </Label>
        <div className="relative">
          <Lock className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="rp-confirm"
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter the password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="pl-9"
            required
          />
        </div>
      </div>

      {error && <p className="text-meta text-danger-700">{error}</p>}

      <Button type="submit" disabled={busy} block>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
        Set new password
      </Button>
    </form>
  );
}
