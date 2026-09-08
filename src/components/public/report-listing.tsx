"use client";

import { useEffect, useState } from "react";
import { Flag, Loader2, Check, X } from "lucide-react";

import { apiFetch, ApiClientError } from "@/lib/api/client";

/**
 * "Report this listing" — a quiet link that opens a small modal with a fixed set
 * of reasons and an optional note. Posts to /api/listings/[id]/report (public,
 * rate-limited 3/hour/IP server-side). Deliberately understated: it's a trust
 * tool, not a call to action.
 */
const REASONS: { value: string; label: string }[] = [
  { value: "fake-listing", label: "Fake or fraudulent listing" },
  { value: "already-sold", label: "Already sold / rented" },
  { value: "wrong-price", label: "Wrong price" },
  { value: "wrong-photos", label: "Wrong or misleading photos" },
  { value: "other", label: "Something else" },
];

export function ReportListing({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape while the modal is open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function reset() {
    setOpen(false);
    // Let the closing animation/paint settle before wiping the form.
    window.setTimeout(() => {
      setReason("");
      setNote("");
      setError(null);
      setDone(false);
      setBusy(false);
    }, 150);
  }

  async function submit() {
    if (!reason) {
      setError("Please choose a reason.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/listings/${listingId}/report`, {
        method: "POST",
        body: JSON.stringify({ reason, note: note.trim() || undefined }),
      });
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Could not send the report. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-meta text-muted-foreground transition-colors hover:text-danger-700"
      >
        <Flag className="size-3.5" /> Report this listing
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-ink-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Report this listing"
          onClick={(e) => {
            if (e.target === e.currentTarget) reset();
          }}
        >
          <div className="w-full max-w-md rounded-t-card border border-border bg-surface p-5 shadow-lift sm:rounded-card">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink-950">Report this listing</h2>
              <button
                type="button"
                onClick={reset}
                aria-label="Close"
                className="rounded-control p-1 text-muted-foreground hover:bg-surface-muted"
              >
                <X className="size-4" />
              </button>
            </div>

            {done ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-success-50 text-success-700">
                  <Check className="size-6" />
                </span>
                <p className="text-sm font-medium text-ink-950">Thanks for the report.</p>
                <p className="text-meta text-muted-foreground">
                  Our team will review this listing.
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="mt-1 rounded-control border border-border px-3 py-1.5 text-sm font-medium text-ink-800 hover:bg-surface-muted"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-meta text-muted-foreground">
                    What&apos;s wrong with it?
                  </legend>
                  {REASONS.map((r) => (
                    <label
                      key={r.value}
                      className="flex cursor-pointer items-center gap-2.5 rounded-control border border-border px-3 py-2 text-sm hover:bg-surface-muted"
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        value={r.value}
                        checked={reason === r.value}
                        onChange={() => setReason(r.value)}
                        className="accent-clay-600"
                      />
                      {r.label}
                    </label>
                  ))}
                </fieldset>

                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Add a note (optional)"
                  className="mt-3 w-full rounded-control border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-ink-400"
                />

                {error && <p className="mt-2 text-meta text-danger-700">{error}</p>}

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-control border border-border px-3 py-2 text-sm font-medium text-ink-800 hover:bg-surface-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-control bg-danger-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-danger-700 disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Flag className="size-4" />}
                    Submit report
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
