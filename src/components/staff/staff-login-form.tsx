"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, Lock, Loader2, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { hardNavigate, fetchWithTimeout, isTimeout } from "@/lib/auth/auth-nav";

/**
 * Staff email + password sign-in. On success the server has set the httpOnly
 * staff cookie; we hard-navigate so the panel loads with the fresh session.
 */
export function StaffLoginForm() {
  const search = useSearchParams();
  const next = search.get("next") || "/staff";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetchWithTimeout("/api/auth/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setError(body?.error?.message ?? "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      hardNavigate(next.startsWith("/staff") ? next : "/staff");
    } catch (err) {
      setError(isTimeout(err) ? "The request timed out. Please try again." : "Network error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="staff-email" required>
          Email
        </Label>
        <div className="relative">
          <Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="staff-email"
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="staff-password" required>
          Password
        </Label>
        <PasswordInput
          icon={Lock}
          id="staff-password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error && <p className="text-meta text-danger-700">{error}</p>}

      <Button type="submit" disabled={busy} block>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
        Sign in
      </Button>
    </form>
  );
}
