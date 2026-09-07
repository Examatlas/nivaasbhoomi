"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Phone, Loader2, MessageCircle, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiClientError } from "@/lib/api/client";

const RESEND_SECONDS = 30;

/**
 * WhatsApp login OTP — single entry point for both buyers and dealers. Enter a
 * number, get a 6-digit code on WhatsApp, verify. First-time buyer numbers are
 * created on verify; a dealer number with no dealer yet is sent to self-
 * registration (/dealer/register). No passwords.
 */
export function OtpLoginForm({ role }: { role: "buyer" | "dealer" }) {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next");

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const code = digits.join("");

  async function sendOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiFetch("/api/auth/otp/send", {
        method: "POST",
        body: JSON.stringify({ phone: phone.trim() }),
      });
      setStep("otp");
      setDigits(Array(6).fill(""));
      setCooldown(RESEND_SECONDS);
      setTimeout(() => boxes.current[0]?.focus(), 50);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(fullCode: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch<{ redirect?: string; needsRegistration?: boolean }>(
        "/api/auth/otp/verify",
        {
          method: "POST",
          body: JSON.stringify({ phone: phone.trim(), code: fullCode, role }),
        },
      );
      // A verified dealer number with no dealer yet → self-registration. That
      // redirect always wins over any `next` (they must register first).
      if (res.needsRegistration && res.redirect) {
        router.replace(res.redirect);
      } else {
        router.replace(next || res.redirect || (role === "dealer" ? "/dealer/dashboard" : "/"));
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not verify the code.");
      setDigits(Array(6).fill(""));
      boxes.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }

  function setDigit(i: number, v: string) {
    const clean = v.replace(/\D/g, "");
    if (!clean) {
      setDigits((d) => d.map((x, idx) => (idx === i ? "" : x)));
      return;
    }
    setDigits((d) => {
      const nextDigits = [...d];
      // Support pasting the whole code into any box.
      if (clean.length > 1) {
        for (let k = 0; k < 6; k++) nextDigits[k] = clean[k] ?? "";
        const full = nextDigits.join("");
        if (full.length === 6) setTimeout(() => verify(full), 0);
        return nextDigits;
      }
      nextDigits[i] = clean;
      if (i < 5) boxes.current[i + 1]?.focus();
      const full = nextDigits.join("");
      if (full.length === 6 && !nextDigits.includes("")) setTimeout(() => verify(full), 0);
      return nextDigits;
    });
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) boxes.current[i - 1]?.focus();
  }

  // ---- Phone step ----
  if (step === "phone") {
    return (
      <form onSubmit={sendOtp} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="otp-phone" required>
            WhatsApp number
          </Label>
          <div className="relative">
            <Phone className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <span className="absolute top-1/2 left-9 -translate-y-1/2 text-sm text-muted-foreground">+91</span>
            <Input
              id="otp-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="pl-16"
              required
            />
          </div>
          <p className="text-meta text-muted-foreground">
            We&apos;ll send a 6-digit code to this number on WhatsApp.
          </p>
        </div>

        {error && <p className="text-meta text-danger-700">{error}</p>}

        <Button type="submit" disabled={busy || !phone.trim()} block>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
          Send code on WhatsApp
        </Button>
      </form>
    );
  }

  // ---- OTP step ----
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => {
          setStep("phone");
          setError(null);
        }}
        className="inline-flex items-center gap-1 self-start text-meta font-medium text-clay-700 hover:underline"
      >
        <ArrowLeft className="size-3.5" /> Change number
      </button>

      <div className="flex flex-col gap-1.5">
        <Label>Enter the 6-digit code</Label>
        <p className="text-meta text-muted-foreground">Sent on WhatsApp to +91 {phone.trim()}</p>
        <div className="mt-1 flex gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                boxes.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={d}
              disabled={busy}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              aria-label={`Digit ${i + 1}`}
              className="h-12 w-full rounded-control border border-border-strong bg-surface text-center text-lg font-semibold text-foreground shadow-subtle focus-visible:border-ink-500 focus-visible:ring-3 focus-visible:ring-ink-600/20 focus-visible:outline-none disabled:opacity-60"
            />
          ))}
        </div>
      </div>

      {error && <p className="text-meta text-danger-700">{error}</p>}

      <Button onClick={() => verify(code)} disabled={busy || code.length !== 6} block>
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        Verify &amp; continue
      </Button>

      <div className="text-center text-meta text-muted-foreground">
        {cooldown > 0 ? (
          <span>Resend code in {cooldown}s</span>
        ) : (
          <button
            type="button"
            onClick={() => sendOtp()}
            disabled={busy}
            className="font-medium text-clay-700 hover:underline disabled:opacity-60"
          >
            Resend code
          </button>
        )}
      </div>
    </div>
  );
}
