"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Phone, Loader2, MessageCircle, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { formatRetryAfter } from "@/lib/auth/otp-retry";
import { safeInternalPath, canSubmitOtp, type VerifyResponse } from "@/lib/auth/otp-verify-nav";
import { hardNavigate } from "@/lib/auth/auth-nav";
import { trackEvent } from "@/lib/analytics/track";

const RESEND_SECONDS = 30;

/** Rate-limit (429) errors carry a retryAfter (seconds) — turn it into a clear
 *  "try again in N" line, and return the seconds so we can pause the resend. */
function rateLimit(err: unknown): { message: string; retryAfter: number } | null {
  if (err instanceof ApiClientError && err.code === "RATE_LIMITED") {
    const seconds = Number((err.details as { retryAfter?: number } | undefined)?.retryAfter);
    const retryAfter = Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 0;
    return { message: retryAfter ? formatRetryAfter(retryAfter) : err.message, retryAfter };
  }
  return null;
}

/**
 * WhatsApp login OTP — single entry point for both buyers and dealers. Enter a
 * number, get a 6-digit code on WhatsApp, verify. First-time buyer numbers are
 * created on verify; a dealer number with no dealer yet is sent to self-
 * registration (/dealer/register). No passwords.
 */
export function OtpLoginForm({ role }: { role: "buyer" | "dealer" }) {
  const search = useSearchParams();
  const next = search.get("next");

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  // Synchronous guards (refs, not state, so they take effect immediately within
  // a single tick): inFlight blocks a second concurrent submit; verified locks
  // the screen for good once a code has been accepted, so the one-time OTP is
  // never burned by a stray retry. Both auto-submit and the button honour them.
  const inFlight = useRef(false);
  const verified = useRef(false);

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
      // Fresh code → unlock the verify screen and clear any prior lock.
      inFlight.current = false;
      verified.current = false;
      setStep("otp");
      setDigits(Array(6).fill(""));
      setCooldown(RESEND_SECONDS);
      setTimeout(() => boxes.current[0]?.focus(), 50);
      trackEvent("otp_send", { context: role });
    } catch (err) {
      const limited = rateLimit(err);
      if (limited) {
        setError(limited.message);
        // Pause the resend button for exactly as long as the server asks.
        if (limited.retryAfter > 0) setCooldown(limited.retryAfter);
      } else {
        setError(err instanceof ApiClientError ? err.message : "Could not send the code.");
      }
    } finally {
      setBusy(false);
    }
  }

  const verify = useCallback(
    async (fullCode: string) => {
      // ONE submit at a time, and never after a successful verify. This is the
      // fix for the double-submit race: without it, the auto-submit (6th digit)
      // and a manual click could both POST, the first burns the OTP server-side,
      // and the second fails with "wrong OTP" while the screen appears stuck.
      if (!canSubmitOtp({ inFlight: inFlight.current, verified: verified.current, codeLength: fullCode.length })) {
        return;
      }
      inFlight.current = true;
      setError(null);
      setBusy(true);
      try {
        const res = await apiFetch<VerifyResponse>("/api/auth/otp/verify", {
          method: "POST",
          // Pass the login page's ?next so the SERVER can honour a deep link;
          // the server decides the real destination and returns it as `next`.
          body: JSON.stringify({ phone: phone.trim(), code: fullCode, role, ...(next ? { next } : {}) }),
        });
        // The client does NOT branch on account state — it only follows the
        // server-decided `next` (guarded against open redirects).
        const dest = safeInternalPath(res.next);
        if (!dest) {
          // Unknown/malformed success — surface it, never silently hang.
          inFlight.current = false;
          setError("Something went wrong. Please try again.");
          setBusy(false);
          return;
        }
        // Success: lock the screen (verified stays true, busy stays true) and do
        // a HARD navigation so the destination renders with the new session — no
        // stale header, and the spinner ends when the page unloads.
        verified.current = true;
        trackEvent("otp_verify_success", { context: role });
        hardNavigate(dest);
      } catch (err) {
        trackEvent("otp_verify_fail", { context: role });
        inFlight.current = false; // allow another attempt with a new code
        const limited = rateLimit(err);
        setError(limited ? limited.message : err instanceof ApiClientError ? err.message : "Could not verify the code.");
        setDigits(Array(6).fill(""));
        boxes.current[0]?.focus();
        setBusy(false);
      }
    },
    [phone, role, next],
  );

  // Auto-submit once all six digits are present — as an EFFECT, not a side
  // effect inside a state updater (updaters must be pure; React may run them
  // twice, which previously fired verify() twice). The guards in verify() make
  // this idempotent.
  useEffect(() => {
    if (step === "otp" && code.length === 6) void verify(code);
  }, [code, step, verify]);

  function setDigit(i: number, v: string) {
    const clean = v.replace(/\D/g, "");
    if (!clean) {
      setDigits((d) => d.map((x, idx) => (idx === i ? "" : x)));
      return;
    }
    // Support pasting the whole code into any box. Focus/side effects live in
    // the handler, never in the setState updater.
    if (clean.length > 1) {
      const filled = Array.from({ length: 6 }, (_, k) => clean[k] ?? "");
      setDigits(filled);
      boxes.current[Math.min(clean.length, 6) - 1]?.focus();
      return; // the effect auto-submits when all six are present
    }
    setDigits((d) => {
      const nextDigits = [...d];
      nextDigits[i] = clean;
      return nextDigits;
    });
    if (i < 5) boxes.current[i + 1]?.focus();
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
          inFlight.current = false;
          verified.current = false;
          setStep("phone");
          setError(null);
          setDigits(Array(6).fill(""));
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
