"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/lib/api/client";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "assigned", label: "Assigned (new)" },
  { value: "contacted", label: "Contacted" },
  { value: "site-visit-scheduled", label: "Site visit scheduled" },
  { value: "site-visit-done", label: "Site visit done" },
  { value: "converted", label: "Converted" },
  { value: "lost", label: "Lost" },
];

/**
 * Dealer-side lead editor: change the lead's status through its lifecycle and
 * save notes. These are the ONLY fields a dealer may edit (Section 13); it calls
 * the owner-scoped PATCH /api/leads/[id].
 */
export function LeadStatusEditor({
  leadId,
  status,
  notes,
}: {
  leadId: string;
  status: string;
  notes?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [noteText, setNoteText] = useState(notes ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = value !== status || noteText !== (notes ?? "");

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await apiFetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: value, dealerNotes: noteText }),
      });
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="h-9 w-auto min-w-[12rem] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={save} disabled={busy || !dirty}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : saved && !dirty ? (
            <Check className="size-4" />
          ) : null}
          Save
        </Button>
        {saved && !dirty && <span className="text-meta text-success-700">Saved</span>}
      </div>
      <Textarea
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        placeholder="Private notes about this lead…"
        rows={2}
        className="text-sm"
      />
      {error && <p className="text-meta text-danger-700">{error}</p>}
    </div>
  );
}
