"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ExternalLink, FileText, CheckCircle2, Circle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import type { AdminDocView } from "@/lib/dealers/admin";

const NO_OVERRIDE = "none";

/**
 * Admin verification panel (DEV-SPEC.txt Section 13). Toggle each document's
 * verified state (the model recomputes the tier), optionally cap the tier with a
 * downgrade-only override, and save notes. RERA shows the state's official
 * portal to check the registration.
 */
export function AdminVerifyPanel({
  dealerId,
  documents,
  tierOverride,
  notes,
}: {
  dealerId: string;
  documents: AdminDocView[];
  tierOverride: number | null;
  notes?: string;
}) {
  const router = useRouter();
  const [verified, setVerified] = useState<Record<string, boolean>>(
    Object.fromEntries(documents.map((d) => [d.key, d.verified])),
  );
  const [override, setOverride] = useState<string>(
    tierOverride == null ? NO_OVERRIDE : String(tierOverride),
  );
  const [noteText, setNoteText] = useState(notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body: Record<string, unknown> = { notes: noteText };
      for (const d of documents) body[d.key] = verified[d.key] ?? false;
      body.override = override === NO_OVERRIDE ? null : Number(override);

      const res = await apiFetch<{ verificationTier: number; unpublishedListings: number }>(
        `/api/admin/dealers/${dealerId}/verify`,
        { method: "POST", body: JSON.stringify(body) },
      );
      setResult(
        `Saved. Tier is now ${res.verificationTier}.` +
          (res.unpublishedListings > 0
            ? ` ${res.unpublishedListings} live listing(s) were unpublished (Tier 0).`
            : ""),
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col divide-y divide-border rounded-card border border-border">
        {documents.map((d) => (
          <div key={d.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => setVerified((v) => ({ ...v, [d.key]: !v[d.key] }))}
              className="inline-flex items-center gap-2 text-sm font-medium"
            >
              {verified[d.key] ? (
                <CheckCircle2 className="size-5 text-success-600" />
              ) : (
                <Circle className="size-5 text-sand-400" />
              )}
              {d.label}
            </button>

            {d.number && <span className="text-meta text-muted-foreground">No. {d.number}</span>}

            <div className="ml-auto flex items-center gap-3">
              {d.key === "rera" && d.reraPortalUrl && (
                <a
                  href={d.reraPortalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-meta font-medium text-clay-700 hover:underline"
                >
                  {d.reraStateName ?? "RERA"} portal <ExternalLink className="size-3" />
                </a>
              )}
              {d.url ? (
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-meta font-medium text-ink-700 hover:underline"
                >
                  <FileText className="size-3.5" /> View
                </a>
              ) : (
                <span className="text-meta text-muted-foreground">not uploaded</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-meta text-muted-foreground">
          Manual tier cap (downgrade only)
          <Select value={override} onValueChange={setOverride}>
            <SelectTrigger className="h-9 w-48 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_OVERRIDE}>No cap</SelectItem>
              {[0, 1, 2, 3, 4].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  Cap at tier {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      <Textarea
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        placeholder="Internal verification notes…"
        rows={2}
      />

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Save verification
        </Button>
        {result && <span className="text-meta text-success-700">{result}</span>}
      </div>
      {error && <p className="text-meta text-danger-700">{error}</p>}
    </div>
  );
}
