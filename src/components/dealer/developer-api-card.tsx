"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  RefreshCw,
  Server,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/lib/api/client";

type GeneratedKey = { key: string; last4: string; createdAt: string };

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed. Please select and copy it manually.");
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={copy} aria-label={`Copy ${label}`}>
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

/** Dealer self-service credentials and integration reference for the Agent API. */
export function DeveloperApiCard({
  apiBaseUrl,
  hasKey,
  last4,
}: {
  apiBaseUrl: string;
  hasKey: boolean;
  last4?: string;
}) {
  const [active, setActive] = useState(hasKey);
  const [keySuffix, setKeySuffix] = useState(last4);
  const [plainKey, setPlainKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generateKey() {
    if (
      active &&
      !confirm(
        "Regenerate this key? The current integration will stop working immediately.",
      )
    ) {
      return;
    }
    setBusy(true);
    setPlainKey(null);
    try {
      const result = await apiFetch<GeneratedKey>("/api/dealers/me/agent-key", {
        method: "POST",
      });
      setPlainKey(result.key);
      setKeySuffix(result.last4);
      setActive(true);
      toast.success("API key generated. Copy it now — it will not be shown again.");
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Could not generate an API key.",
      );
    } finally {
      setBusy(false);
    }
  }

  const searchUrl = `${apiBaseUrl}/search`;
  const leadUrl = `${apiBaseUrl}/lead`;
  const searchExample = `curl "${searchUrl}?purpose=sale&limit=10" \\\n+  -H "X-Agent-Key: YOUR_API_KEY"`;
  const leadExample = `curl -X POST "${leadUrl}" \\\n+  -H "Content-Type: application/json" \\\n+  -H "X-Agent-Key: YOUR_API_KEY" \\\n+  -d '{"name":"Priya Sharma","phone":"9876543210","listingId":"LISTING_ID","message":"Interested in a site visit"}'`;

  return (
    <section className="mt-8 rounded-card border border-border bg-surface p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-ink-50 text-ink-700">
            <Server className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-ink-950">Developer API</h2>
            <p className="text-meta text-muted-foreground">
              Connect your website or CRM to your listings and leads
            </p>
          </div>
        </div>
        <span
          className={
            active
              ? "rounded-full bg-success-50 px-2.5 py-1 text-meta font-medium text-success-700"
              : "rounded-full bg-ink-50 px-2.5 py-1 text-meta font-medium text-ink-700"
          }
        >
          {active ? `Key active · …${keySuffix}` : "No key yet"}
        </span>
      </div>

      <p className="mt-5 text-sm text-muted-foreground">
        Give your developer this API URL and key to show only your approved listings on
        another website. They can also send enquiries straight into this dashboard.
      </p>

      <div className="mt-5 rounded-card border border-border bg-surface-muted p-4">
        <p className="text-meta font-medium text-muted-foreground">API base URL</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 text-sm break-all text-ink-950">
            {apiBaseUrl}
          </code>
          <CopyButton value={apiBaseUrl} label="API base URL" />
        </div>
      </div>

      {plainKey && (
        <div className="mt-4 rounded-card border border-clay-200 bg-clay-50 p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium text-clay-900">
            <KeyRound className="size-4" /> Copy this key now — it is shown only once.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 rounded-control bg-surface px-3 py-2 text-sm break-all text-ink-950">
              {plainKey}
            </code>
            <CopyButton value={plainKey} label="API key" />
          </div>
        </div>
      )}

      <Button className="mt-5" size="sm" onClick={generateKey} disabled={busy}>
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : active ? (
          <RefreshCw className="size-4" />
        ) : (
          <KeyRound className="size-4" />
        )}
        {active ? "Regenerate API key" : "Generate API key"}
      </Button>

      <details className="group mt-6 border-t border-border pt-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink-950 [&::-webkit-details-marker]:hidden">
          Developer documentation
          <ExternalLink className="size-4 text-muted-foreground" />
        </summary>
        <div className="mt-5 space-y-6 text-sm text-muted-foreground">
          <div>
            <h3 className="font-semibold text-ink-950">Authentication</h3>
            <p className="mt-1">
              Send your key in the{" "}
              <code className="rounded bg-ink-50 px-1 py-0.5 text-ink-800">
                X-Agent-Key
              </code>{" "}
              header. Keep it on your server; never expose it in browser code.
            </p>
          </div>
          <ApiExample
            title="Get my approved listings"
            url={searchUrl}
            description="GET. Returns only this dealer’s approved, non-demo listings. Optional filters: city, locality, type, purpose (sale or rent), budget_min, budget_max, bhk, limit (max 25), and cursor."
            code={searchExample}
          />
          <ApiExample
            title="Create a lead"
            url={leadUrl}
            description="POST. Required: phone. Optional: name, listingId, message, and intent. Indian mobile numbers are accepted with or without +91."
            code={leadExample}
          />
          <p className="rounded-control bg-ink-50 p-3 text-meta text-ink-700">
            Responses use <code>\u007b success, data \u007d</code>. The API allows 60
            requests per minute and 2,000 per day. Regenerating a key revokes the old one
            immediately.
          </p>
        </div>
      </details>
    </section>
  );
}

function ApiExample({
  title,
  url,
  description,
  code,
}: {
  title: string;
  url: string;
  description: string;
  code: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-ink-950">{title}</h3>
        <code className="text-meta text-clay-700">{url}</code>
      </div>
      <p className="mt-1">{description}</p>
      <pre className="mt-3 overflow-x-auto rounded-control bg-ink-950 p-3 text-meta leading-5 text-ink-50">
        <code>{code}</code>
      </pre>
    </div>
  );
}
