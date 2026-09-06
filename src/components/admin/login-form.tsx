"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiClientError } from "@/lib/api/client";

/** Admin login form. Posts to /api/auth/admin/login, then routes to `next`. */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/admin/locations";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/api/auth/admin/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      // Full navigation so the proxy re-evaluates with the new cookie.
      router.replace(next.startsWith("/admin") ? next : "/admin/locations");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Login failed.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error && (
        <p className="rounded-control border border-danger-100 bg-danger-50 px-3 py-2 text-meta text-danger-700">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" block disabled={submitting}>
        {submitting && <Loader2 className="animate-spin" />} Sign in
      </Button>
    </form>
  );
}
