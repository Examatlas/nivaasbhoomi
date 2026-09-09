"use client";

import { useCallback, useRef, useState } from "react";

import { apiFetch, ApiClientError } from "@/lib/api/client";
import { formatRetryAfter } from "@/lib/auth/otp-retry";
import { useSession } from "@/components/auth/session-provider";
import { trackEvent } from "@/lib/analytics/track";

/**
 * Reusable lead-magnet flow (shared by every tool). The buyer fills a tool and
 * calls start(input): if already logged in, the lead is created immediately and
 * the result returned; otherwise a WhatsApp OTP gate (the EXISTING otp/send +
 * otp/verify service) runs first, then the lead is created. On success the
 * server-computed `result` is exposed.
 *
 *   phase: "form"  → collecting tool input
 *          "phone" → ask for the WhatsApp number
 *          "code"  → enter the 6-digit OTP
 *          "done"  → result is ready
 */
export type ToolLeadPhase = "form" | "phone" | "code" | "done";

export function useToolLead<O = Record<string, unknown>>(tool: string) {
  const { me } = useSession();
  const [phase, setPhase] = useState<ToolLeadPhase>("form");
  const [result, setResult] = useState<O | null>(null);
  const [deduped, setDeduped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingInput = useRef<unknown>(null);
  const inFlight = useRef(false);

  const submitLead = useCallback(
    async (input: unknown) => {
      const res = await apiFetch<{ output: O; leadId: string; deduped: boolean }>(
        "/api/tools/lead",
        { method: "POST", body: JSON.stringify({ tool, input }) },
      );
      setResult(res.output);
      setDeduped(res.deduped);
      setPhase("done");
      trackEvent("tool_use", { tool });
      trackEvent("lead_submit", { source: `tool_${tool}` });
    },
    [tool],
  );

  /** Begin: logged-in → straight to the result; logged-out → OTP gate. */
  const start = useCallback(
    async (input: unknown) => {
      setError(null);
      pendingInput.current = input;
      if (me?.authed) {
        if (inFlight.current) return;
        inFlight.current = true;
        setBusy(true);
        try {
          await submitLead(input);
        } catch (e) {
          setError(e instanceof ApiClientError ? e.message : "Something went wrong. Please try again.");
        } finally {
          setBusy(false);
          inFlight.current = false;
        }
      } else {
        setPhase("phone");
      }
    },
    [me?.authed, submitLead],
  );

  const sendCode = useCallback(async (phone: string) => {
    setError(null);
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await apiFetch("/api/auth/otp/send", { method: "POST", body: JSON.stringify({ phone }) });
      setPhase("code");
      trackEvent("otp_send", { context: "tool", tool });
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "RATE_LIMITED") {
        const s = Number((e.details as { retryAfter?: number } | undefined)?.retryAfter);
        setError(Number.isFinite(s) && s > 0 ? formatRetryAfter(s) : e.message);
      } else {
        setError(e instanceof ApiClientError ? e.message : "Could not send the code.");
      }
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }, [tool]);

  const verifyCode = useCallback(
    async (phone: string, code: string) => {
      setError(null);
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      try {
        // Existing OTP verify (role buyer) signs the buyer session…
        await apiFetch("/api/auth/otp/verify", {
          method: "POST",
          body: JSON.stringify({ phone, code, role: "buyer" }),
        });
        trackEvent("otp_verify_success", { context: "tool", tool });
        // …then the now-authenticated request creates the lead + returns the result.
        await submitLead(pendingInput.current);
      } catch (e) {
        trackEvent("otp_verify_fail", { context: "tool", tool });
        setError(e instanceof ApiClientError ? e.message : "Could not verify the code.");
      } finally {
        setBusy(false);
        inFlight.current = false;
      }
    },
    [submitLead, tool],
  );

  const backToForm = useCallback(() => {
    setPhase("form");
    setError(null);
  }, []);

  return {
    phase,
    result,
    deduped,
    busy,
    error,
    start,
    sendCode,
    verifyCode,
    backToForm,
    setError,
  };
}
