"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api/client";

interface Health {
  provider: "zenith" | "meta";
  zenithConfigured: boolean;
  windowHours: number;
  total: number;
  zenithSends: number;
  fallbacks: number;
  failures: number;
}

/** Small admin status card: active WhatsApp provider + last-24h send health. */
export function WhatsAppHealthCard() {
  const [h, setH] = useState<Health | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Health>("/api/admin/whatsapp/health")
      .then(setH)
      .catch(() => setErr("Couldn't load health."));
  }, []);

  return (
    <section className="rounded-card border border-border bg-surface p-5 text-sm">
      <h2 className="mb-2 font-semibold text-ink-950">WhatsApp send health</h2>
      {err && <p className="text-meta text-muted-foreground">{err}</p>}
      {!h && !err && <p className="text-meta text-muted-foreground">Loading…</p>}
      {h && (
        <>
          <p className="text-muted-foreground">
            Provider:{" "}
            <b className="text-ink-900">{h.provider === "zenith" ? "Zenith Code" : "Meta"}</b>
            {h.provider === "zenith" && !h.zenithConfigured && (
              <span className="ml-1 text-danger-700">(API key missing)</span>
            )}
          </p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-control bg-surface-muted px-2 py-2">
              <dt className="text-overline text-subtle-foreground uppercase">Zenith</dt>
              <dd className="tabular text-lg font-semibold text-ink-950">{h.zenithSends}</dd>
            </div>
            <div className="rounded-control bg-surface-muted px-2 py-2">
              <dt className="text-overline text-subtle-foreground uppercase">Fallbacks</dt>
              <dd
                className={`tabular text-lg font-semibold ${h.fallbacks > 0 ? "text-warning-700" : "text-ink-950"}`}
              >
                {h.fallbacks}
              </dd>
            </div>
            <div className="rounded-control bg-surface-muted px-2 py-2">
              <dt className="text-overline text-subtle-foreground uppercase">Failures</dt>
              <dd
                className={`tabular text-lg font-semibold ${h.failures > 0 ? "text-danger-700" : "text-ink-950"}`}
              >
                {h.failures}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-meta text-subtle-foreground">
            Last {h.windowHours}h · {h.total} send{h.total === 1 ? "" : "s"}
          </p>
        </>
      )}
    </section>
  );
}
