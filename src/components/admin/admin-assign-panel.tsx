"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus, AlertTriangle } from "lucide-react";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/lib/api/client";

export interface EligibleDealerOption {
  id: string;
  businessName: string;
  tier: number;
  quota: string;
  hasQuota: boolean;
  coversCity: boolean;
}

/**
 * Admin lead placement (DEV-SPEC.txt Section 12/15). Two modes:
 *  - unassigned lead  -> manual ASSIGN to a chosen eligible dealer.
 *  - assigned lead    -> admin OVERRIDE reassignment (the one sanctioned break
 *    of the exclusivity lock; requires a reason and a clear confirm).
 * Both go through POST /api/leads/[id]/assign, which applies the assign()
 * side-effects and writes an audit record server-side.
 */
export function AdminAssignPanel({
  leadId,
  isAssigned,
  currentDealerName,
  dealers,
}: {
  leadId: string;
  isAssigned: boolean;
  currentDealerName?: string;
  dealers: EligibleDealerOption[];
}) {
  const router = useRouter();
  const [dealerId, setDealerId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit() {
    if (!dealerId) {
      setError("Pick a dealer.");
      return;
    }
    if (isAssigned && reason.trim().length < 3) {
      setError("An override needs a reason (audit trail).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ action: string; dealerId: string }>(
        `/api/leads/${leadId}/assign`,
        {
          method: "POST",
          body: JSON.stringify({
            dealerId,
            override: isAssigned,
            ...(isAssigned ? { reason: reason.trim() } : {}),
          }),
        },
      );
      setDone(res.action === "reassigned" ? "Lead reassigned." : "Lead assigned.");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not assign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <h3 className="flex items-center gap-2 font-semibold text-ink-950">
        {isAssigned ? (
          <>
            <AlertTriangle className="size-4 text-warning-600" /> Admin override reassignment
          </>
        ) : (
          <>
            <UserPlus className="size-4 text-clay-600" /> Assign this lead
          </>
        )}
      </h3>

      {isAssigned ? (
        <p className="mt-1 text-meta text-warning-700">
          This lead is locked to <b>{currentDealerName ?? "a dealer"}</b>. Reassigning is an
          admin-only override of the exclusivity rule and is logged to the audit trail.
        </p>
      ) : (
        <p className="mt-1 text-meta text-muted-foreground">
          Place this unmatched lead onto a dealer. Coverage matches are listed first;
          quota is shown but not enforced.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2">
        <Select value={dealerId || undefined} onValueChange={setDealerId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a dealer" />
          </SelectTrigger>
          <SelectContent>
            {dealers.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.businessName} — tier {d.tier}, quota {d.quota}
                {d.coversCity ? " ✓ covers city" : ""}
                {!d.hasQuota ? " (over quota)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isAssigned && (
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for override (required, audited)"
            maxLength={500}
          />
        )}

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={submit} disabled={busy} variant={isAssigned ? "danger" : "primary"}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {isAssigned ? "Override & reassign" : "Assign"}
          </Button>
          {done && <span className="text-meta text-success-700">{done}</span>}
        </div>
        {error && <p className="text-meta text-danger-700">{error}</p>}
      </div>
    </div>
  );
}
