"use client";

import { useState } from "react";
import { KeyRound, Loader2, Copy, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import type { AgentKeyInfo } from "@/lib/agent/admin";

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

/**
 * Admin "Agent API key" section for a dealer. Generate/Regenerate reveals the
 * plaintext key EXACTLY ONCE; afterwards only the last 4 chars are shown.
 * zenithOrgId is editable here too.
 */
export function DealerAgentKey({ dealerId, info }: { dealerId: string; info: AgentKeyInfo }) {
  const [last4, setLast4] = useState(info.last4);
  const [hasKey, setHasKey] = useState(info.hasKey);
  const [plain, setPlain] = useState<string | null>(null); // shown once
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const [orgId, setOrgId] = useState(info.zenithOrgId ?? "");
  const [savingOrg, setSavingOrg] = useState(false);

  async function generate() {
    if (hasKey && !confirm("Regenerate? The current key stops working immediately.")) return;
    setBusy(true);
    setPlain(null);
    try {
      const res = await apiFetch<{ key: string; last4: string }>(
        `/api/admin/dealers/${dealerId}/agent-key`,
        { method: "POST" },
      );
      setPlain(res.key);
      setLast4(res.last4);
      setHasKey(true);
      toast.success("Agent API key generated — copy it now, it won't be shown again.");
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Could not generate the key.");
    } finally {
      setBusy(false);
    }
  }

  function copyKey() {
    if (!plain) return;
    navigator.clipboard
      ?.writeText(plain)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => toast.error("Copy failed"));
  }

  async function saveOrg() {
    setSavingOrg(true);
    try {
      await apiFetch(`/api/admin/dealers/${dealerId}`, {
        method: "PATCH",
        body: JSON.stringify({ zenithOrgId: orgId.trim() }),
      });
      toast.success("Zenith org id saved");
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Could not save.");
    } finally {
      setSavingOrg(false);
    }
  }

  return (
    <section className="rounded-card border border-border bg-surface p-5 text-sm">
      <h2 className="mb-3 flex items-center gap-1.5 font-semibold text-ink-950">
        <KeyRound className="size-4 text-clay-600" /> Agent API key
      </h2>

      {/* Show-once plaintext */}
      {plain && (
        <div className="mb-3 rounded-control border border-clay-200 bg-clay-50 p-3">
          <p className="text-meta text-clay-800">
            Copy this now — it is shown only once and never again.
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1 text-meta text-ink-900">
              {plain}
            </code>
            <Button size="sm" variant="outline" onClick={copyKey}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <dt className="text-muted-foreground">Status</dt>
        <dd className="text-right font-medium text-ink-950">
          {hasKey ? `Active · …${last4}` : "Not generated"}
        </dd>
        <dt className="text-muted-foreground">Created</dt>
        <dd className="text-right text-ink-800">{fmt(info.createdAt)}</dd>
        <dt className="text-muted-foreground">Last used</dt>
        <dd className="text-right text-ink-800">{fmt(info.lastUsedAt)}</dd>
        <dt className="text-muted-foreground">Requests today</dt>
        <dd className="tabular text-right font-medium text-ink-950">{info.requestsToday}</dd>
      </dl>

      <Button className="mt-3" size="sm" onClick={generate} disabled={busy} block>
        {busy ? <Loader2 className="size-4 animate-spin" /> : hasKey ? <RefreshCw className="size-4" /> : <KeyRound className="size-4" />}
        {hasKey ? "Regenerate key" : "Generate key"}
      </Button>

      <div className="mt-4 border-t border-border pt-3">
        <Label htmlFor="zenithOrgId">Zenith org id</Label>
        <div className="mt-1 flex gap-2">
          <Input
            id="zenithOrgId"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            placeholder="zenith org / account id"
            maxLength={120}
          />
          <Button size="sm" variant="outline" onClick={saveOrg} disabled={savingOrg}>
            {savingOrg ? <Loader2 className="size-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>
    </section>
  );
}
