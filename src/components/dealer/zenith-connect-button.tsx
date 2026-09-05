"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ZENITH_ERROR_MESSAGES } from "@/lib/zenith/errors";

const START_URL = "/api/auth/zenith/start";

/**
 * Connect-with-Zenith button. Opens the OAuth flow in a centered popup and keeps
 * this page in place; the callback postMessages the result back and this button
 * refreshes to the Connected state (success) or shows the error (failure).
 * Falls back to a full-page redirect if the popup is blocked.
 *
 * window.open MUST run synchronously in the click handler (no await before it),
 * or the browser treats it as a non-user-gesture popup and blocks it.
 */
export function ZenithConnectButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const listenerRef = useRef<((e: MessageEvent) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (pollRef.current != null) window.clearInterval(pollRef.current);
    pollRef.current = null;
    if (listenerRef.current) window.removeEventListener("message", listenerRef.current);
    listenerRef.current = null;
  }, []);

  // Remove listener/interval on unmount.
  useEffect(() => cleanup, [cleanup]);

  function connect() {
    setError(null);

    // Center on the CURRENT monitor (multi-monitor safe).
    const w = 520;
    const h = 700;
    const dualLeft = window.screenX ?? window.screenLeft ?? 0;
    const dualTop = window.screenY ?? window.screenTop ?? 0;
    const width = window.outerWidth || document.documentElement.clientWidth || screen.width;
    const height = window.outerHeight || document.documentElement.clientHeight || screen.height;
    const left = Math.round(dualLeft + (width - w) / 2);
    const top = Math.round(dualTop + (height - h) / 2);
    const features = `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`;

    // Synchronous — first thing in the handler, no await before it.
    const popup = window.open(`${START_URL}?popup=1`, "zenith_oauth", features);

    // Blocked -> fall back to the existing full-page redirect.
    if (!popup) {
      window.location.href = START_URL;
      return;
    }

    setBusy(true);

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { source?: string; status?: string; code?: string | null } | null;
      if (!data || data.source !== "nivaasbhoomi-zenith") return;

      cleanup();
      try {
        popup.close();
      } catch {
        /* ignore */
      }
      setBusy(false);

      if (data.status === "success") {
        router.refresh(); // flip to Connected without a full reload
      } else {
        setError(typeof data.code === "string" ? data.code : "exchange");
      }
    };
    listenerRef.current = onMessage;
    window.addEventListener("message", onMessage);

    // Manual close with no message -> silently reset (no error banner).
    pollRef.current = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        setBusy(false);
      }
    }, 500);
  }

  return (
    <div>
      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-card border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{ZENITH_ERROR_MESSAGES[error] ?? "Couldn't connect to Zenith Code."}</p>
        </div>
      )}
      <Button onClick={connect} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {busy ? "Connecting…" : "Connect with Zenith Code"}
      </Button>
    </div>
  );
}
