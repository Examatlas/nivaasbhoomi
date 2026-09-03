"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Phone, KeyRound, Loader2, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Dealer WhatsApp OTP login (DEV-SPEC.txt Section 8). Two steps: enter phone ->
 * receive OTP on WhatsApp -> enter OTP. On success the server has set the
 * httpOnly session cookie, so we just navigate to the dealer area.
 *
 * In development, if WhatsApp isn't configured the send endpoint returns the
 * code (devOtp); we surface it so login is testable without live WhatsApp.
 */
type Step = "phone" | "otp";

export function OtpLoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/dealer/dashboard";

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDevOtp(null);
    try {
      const res = await fetch("/api/auth/dealer/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setError(body?.error?.message ?? "Could not send OTP. Try again.");
        return;
      }
      if (body.data?.devOtp) setDevOtp(body.data.devOtp);
      setStep("otp");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/dealer/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setError(body?.error?.message ?? "Invalid OTP. Try again.");
        return;
      }
      // Cookie is set; go to the dealer area (full nav so the proxy re-runs).
      router.replace(next);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "phone") {
    return (
      <form onSubmit={sendOtp} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">WhatsApp number</Label>
          <div className="relative">
            <Phone className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="pl-9"
              required
            />
          </div>
          <p className="text-meta text-muted-foreground">
            We&apos;ll send a one-time code to this number on WhatsApp.
          </p>
        </div>

        {error && <p className="text-meta text-danger-700">{error}</p>}

        <Button type="submit" disabled={busy} block>
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MessageCircle className="size-4" />
          )}
          Send OTP on WhatsApp
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={verifyOtp} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="otp">Enter the 6-digit code</Label>
        <div className="relative">
          <KeyRound className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="______"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            className="pl-9 tracking-[0.4em]"
            required
          />
        </div>
        <p className="text-meta text-muted-foreground">
          Sent to +{phone.replace(/\D/g, "")}.{" "}
          <button
            type="button"
            className="text-clay-700 hover:underline"
            onClick={() => {
              setStep("phone");
              setOtp("");
              setError(null);
            }}
          >
            Change number
          </button>
        </p>
      </div>

      {devOtp && (
        <p className="rounded-control border border-warning-100 bg-warning-50 px-3 py-2 text-meta text-warning-700">
          Dev mode: WhatsApp isn&apos;t configured, so your code is{" "}
          <span className="font-mono font-semibold">{devOtp}</span>.
        </p>
      )}

      {error && <p className="text-meta text-danger-700">{error}</p>}

      <Button type="submit" disabled={busy || otp.length !== 6} block>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
        Verify & sign in
      </Button>
    </form>
  );
}
