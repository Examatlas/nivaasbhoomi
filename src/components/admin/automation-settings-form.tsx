"use client";

import { useState } from "react";
import { Loader2, Check, PlugZap } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import type { AutomationSettingsView } from "@/lib/settings/automation";

/**
 * Admin form for the Zenith Code connection. Secrets are write-only: the current
 * values show as a masked preview, and blank fields keep the stored value.
 */
export function AutomationSettingsForm({ initial }: { initial: AutomationSettingsView }) {
  const [provider, setProvider] = useState(initial.provider);
  const [baseUrl, setBaseUrl] = useState(initial.zenithBaseUrl);
  const [accountId, setAccountId] = useState(initial.zenithAccountId);
  const [apiKey, setApiKey] = useState("");
  const [ingestSecret, setIngestSecret] = useState("");
  const [view, setView] = useState(initial);

  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await apiFetch<AutomationSettingsView>("/api/admin/automation", {
        method: "PUT",
        body: JSON.stringify({
          provider,
          zenithBaseUrl: baseUrl,
          zenithAccountId: accountId,
          ...(apiKey.trim() ? { zenithApiKey: apiKey.trim() } : {}),
          ...(ingestSecret.trim() ? { ingestSigningSecret: ingestSecret.trim() } : {}),
        }),
      });
      setView(next);
      setApiKey("");
      setIngestSecret("");
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function testConnection() {
    setTestBusy(true);
    setTestResult(null);
    try {
      const r = await apiFetch<{ reachable: boolean; status?: number; note: string }>(
        "/api/admin/automation/test",
        { method: "POST" },
      );
      setTestResult(r.note);
    } catch (e) {
      setTestResult(e instanceof ApiClientError ? e.message : "Test failed.");
    } finally {
      setTestBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label>Messaging provider</Label>
        <Select value={provider} onValueChange={(v) => setProvider(v as "zenith" | "meta")}>
          <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="meta">Meta Cloud API (direct) — default</SelectItem>
            <SelectItem value="zenith">Zenith Code (aggregator + AI)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-meta text-muted-foreground">
          When set to Zenith, NivaasBhoomi&apos;s own Meta webhook + n8n go dormant and
          business messages send via Zenith. Login OTP is unaffected.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Zenith base URL</Label>
          <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://app.zenithcode.io/api" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Account / workspace ID (optional)</Label>
          <Input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="acct_…" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Zenith API key</Label>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={view.hasApiKey ? `Stored: ${view.apiKeyPreview} — leave blank to keep` : "Paste your Zenith API key"}
        />
        {view.fromEnv.apiKey && <p className="text-meta text-warning-700">Currently set via environment variable.</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Ingest signing secret</Label>
        <Input
          type="password"
          value={ingestSecret}
          onChange={(e) => setIngestSecret(e.target.value)}
          placeholder={view.hasIngestSecret ? `Stored: ${view.ingestSecretPreview} — leave blank to keep` : "Secret Zenith uses to sign lead pushes"}
        />
        <p className="text-meta text-muted-foreground">
          Zenith signs each lead push to <code>/api/leads/ingest</code> with this. Configure
          the same secret in Zenith. {view.fromEnv.ingestSecret && "Currently set via environment variable."}
        </p>
      </div>

      {error && <p className="text-sm text-danger-700">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
          Save settings
        </Button>
        <Button variant="outline" onClick={testConnection} disabled={testBusy}>
          {testBusy ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
          Test connection
        </Button>
        {saved && <span className="text-meta text-success-700">Saved</span>}
      </div>
      {testResult && (
        <p className="rounded-control border border-border bg-surface-muted px-3 py-2 text-meta text-foreground">
          {testResult}
        </p>
      )}
    </div>
  );
}
