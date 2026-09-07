"use client";

import { useState } from "react";
import { Bell, BellRing, Loader2, MessageCircle, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { formatRetryAfter } from "@/lib/auth/otp-retry";
import { useSession } from "@/components/auth/session-provider";

export interface AlertCriteriaInput {
  cityId: string;
  localityIds?: string[];
  propertyType?: string | null;
  purpose: "buy" | "rent";
  budgetMin?: number | null;
  budgetMax?: number | null;
  bedrooms?: string | null;
}

/** "Set a WhatsApp alert for this search" — creates a SavedSearch from the
 *  current filters. Logged in → saves instantly; logged out → the SAME WhatsApp
 *  OTP flow (Phase 1) first, then saves. Max 5 active alerts (server-enforced). */
export function SaveAlertButton({ criteria, label }: { criteria: AlertCriteriaInput; label?: string }) {
  const { me } = useSession();
  const [phase, setPhase] = useState<"idle" | "phone" | "code" | "done">("idle");
  const [phone, setPhone] = useState("");
  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    await apiFetch("/api/alerts", { method: "POST", body: JSON.stringify({ criteria }) });
    setPhase("done");
  }

  async function onClick() {
    setError(null);
    if (me?.authed) {
      setBusy(true);
      try {
        await create();
      } catch (e) {
        setError(e instanceof ApiClientError ? e.message : "Could not save the alert.");
      } finally {
        setBusy(false);
      }
    } else {
      setPhase("phone");
    }
  }

  async function sendCode() {
    setError(null);
    setBusy(true);
    try {
      await apiFetch("/api/auth/otp/send", { method: "POST", body: JSON.stringify({ phone: phone.trim() }) });
      setPhase("code");
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "RATE_LIMITED") {
        const s = Number((e.details as { retryAfter?: number } | undefined)?.retryAfter);
        setError(Number.isFinite(s) && s > 0 ? formatRetryAfter(s) : e.message);
      } else setError(e instanceof ApiClientError ? e.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setError(null);
    setBusy(true);
    try {
      await apiFetch("/api/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ phone: phone.trim(), code: digits, role: "buyer" }),
      });
      await create();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not verify the code.");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "done") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-control border border-success-100 bg-success-50 px-3 py-2 text-sm font-medium text-success-700">
        <BellRing className="size-4" /> Alert set — we&apos;ll WhatsApp you new matches
      </span>
    );
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={busy}>
        {busy && phase === "idle" ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
        {label ?? "Set a WhatsApp alert"}
      </Button>
      {phase === "idle" && error && <p className="mt-1 text-meta text-danger-700">{error}</p>}

      {(phase === "phone" || phase === "code") && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/50 p-4" onClick={() => !busy && setPhase("idle")}>
          <div className="w-full max-w-sm rounded-card border border-border bg-surface p-5 shadow-card" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-lg font-semibold text-ink-950">
                <Bell className="size-5 text-clay-600" /> Set your alert
              </h2>
              <button type="button" onClick={() => setPhase("idle")} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
            </div>
            {phase === "phone" ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">Verify your WhatsApp number to get new-property alerts for this search.</p>
                <div className="flex flex-col gap-1.5">
                  <Label required>WhatsApp number</Label>
                  <div className="relative">
                    <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">+91</span>
                    <Input type="tel" inputMode="numeric" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} className="pl-12" />
                  </div>
                </div>
                {error && <p className="text-meta text-danger-700">{error}</p>}
                <Button type="button" onClick={sendCode} disabled={busy || !phone.trim()} block>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />} Send code
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to +91 {phone.trim()}.</p>
                <Input type="text" inputMode="numeric" maxLength={6} placeholder="6-digit code" value={digits} onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 6))} className="text-center text-lg font-semibold tracking-[0.3em]" />
                {error && <p className="text-meta text-danger-700">{error}</p>}
                <Button type="button" onClick={verifyCode} disabled={busy || digits.length !== 6} block>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Verify &amp; set alert
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
