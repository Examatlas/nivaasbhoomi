"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Building2, Phone, Loader2, LogIn, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Dealer email + password sign-in / sign-up (LAUNCH auth). Signup collects the
 * business name + WhatsApp/contact number; the dealer completes coverage on
 * onboarding (the dashboard redirects there until the profile is complete). On
 * success the server has set the httpOnly dealer cookie.
 */
type Mode = "login" | "signup";

export function DealerAuthForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/dealer/dashboard";

  const [mode, setMode] = useState<Mode>(search.get("mode") === "signup" ? "signup" : "login");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const endpoint = mode === "signup" ? "/api/auth/dealer/signup" : "/api/auth/dealer/login";
      const payload =
        mode === "signup"
          ? {
              businessName: businessName.trim(),
              email: email.trim(),
              phone: phone.trim(),
              password,
            }
          : { email: email.trim(), password };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setError(body?.error?.message ?? "Something went wrong. Please try again.");
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {isSignup && (
        <Field
          id="da-business"
          label="Business name"
          icon={Building2}
          value={businessName}
          onChange={setBusinessName}
          placeholder="e.g. Ranchi Prime Properties"
          autoComplete="organization"
          required
        />
      )}

      <Field
        id="da-email"
        label="Email"
        icon={Mail}
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="you@example.com"
        autoComplete="email"
        required
      />

      {isSignup && (
        <Field
          id="da-phone"
          label="WhatsApp / contact number"
          icon={Phone}
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={setPhone}
          placeholder="10-digit mobile"
          autoComplete="tel"
          required
          hint="Buyers' enquiries reach you; this is the number they'll call."
        />
      )}

      <Field
        id="da-password"
        label="Password"
        icon={Lock}
        type="password"
        value={password}
        onChange={setPassword}
        placeholder={isSignup ? "At least 8 characters" : "Your password"}
        autoComplete={isSignup ? "new-password" : "current-password"}
        required
      />

      {error && <p className="text-meta text-danger-700">{error}</p>}

      <Button type="submit" disabled={busy} block>
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : isSignup ? (
          <UserPlus className="size-4" />
        ) : (
          <LogIn className="size-4" />
        )}
        {isSignup ? "Create dealer account" : "Sign in"}
      </Button>

      <p className="text-center text-meta text-muted-foreground">
        {isSignup ? "Already registered?" : "New dealer?"}{" "}
        <button
          type="button"
          className="font-medium text-clay-700 hover:underline"
          onClick={() => {
            setMode(isSignup ? "login" : "signup");
            setError(null);
          }}
        >
          {isSignup ? "Sign in" : "Create an account"}
        </button>
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  icon: Icon,
  value,
  onChange,
  type = "text",
  inputMode,
  placeholder,
  autoComplete,
  required,
  hint,
}: {
  id: string;
  label: string;
  icon: React.ElementType;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: "numeric";
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <div className="relative">
        <Icon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-9"
          required={required}
        />
      </div>
      {hint && <p className="text-meta text-muted-foreground">{hint}</p>}
    </div>
  );
}
