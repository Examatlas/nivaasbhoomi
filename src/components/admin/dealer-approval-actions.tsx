"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/lib/api/client";

/**
 * Admin Approve / Reject for a signup-gate dealer (status pending or rejected).
 * Approve flips the dealer to "active"; Reject opens a reason field and sets
 * "rejected". Both email the dealer server-side. Only shown on gate-state rows.
 */
export function DealerApprovalActions({
  dealerId,
  status,
}: {
  dealerId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "approve" | "reject">(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    setBusy(action);
    setError(null);
    try {
      await apiFetch(`/api/admin/dealers/${dealerId}/approval`, {
        method: "POST",
        body: JSON.stringify({ action, ...(action === "reject" ? { reason: reason.trim() } : {}) }),
      });
      setRejecting(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  if (rejecting) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (emailed to dealer)"
          maxLength={1000}
          className="h-8 w-56 text-sm"
        />
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setRejecting(false)} disabled={busy !== null}>
            Cancel
          </Button>
          <Button type="button" size="sm" variant="danger" onClick={() => act("reject")} disabled={busy !== null}>
            {busy === "reject" ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
            Confirm reject
          </Button>
        </div>
        {error && <p className="text-meta text-danger-700">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {status !== "active" && (
          <Button type="button" size="sm" onClick={() => act("approve")} disabled={busy !== null}>
            {busy === "approve" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Approve
          </Button>
        )}
        {status === "pending" && (
          <Button type="button" size="sm" variant="outline" onClick={() => setRejecting(true)} disabled={busy !== null}>
            <X className="size-3.5" /> Reject
          </Button>
        )}
      </div>
      {error && <p className="text-meta text-danger-700">{error}</p>}
    </div>
  );
}
