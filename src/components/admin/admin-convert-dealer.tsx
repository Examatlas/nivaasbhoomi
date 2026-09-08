"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Store, X, Check } from "lucide-react";

import { CoverageEditor, type CoverageEntry } from "@/components/dealer/coverage-editor";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { validateRegId, normalizeRegId, RERA_HELP } from "@/lib/validation/registration-ids";

const DEAL_TYPES = [
  { value: "plot", label: "Plots" },
  { value: "flat", label: "Flats" },
  { value: "house", label: "Houses" },
  { value: "commercial", label: "Commercial" },
  { value: "rent", label: "Rentals" },
  { value: "resale", label: "Resale" },
];

/**
 * Admin "Convert to Dealer" (STEP 2). Opens a modal to create an ACTIVE dealer
 * from a buyer User (rescues the orphan Users). Name + phone come from the user
 * (phone read-only); the admin fills business name, coverage, deal types and any
 * reg-ids. On success the page refreshes so the row reflects the new dealer.
 */
export function AdminConvertDealer({
  userId,
  userName,
  userPhone,
}: {
  userId: string;
  userName: string;
  userPhone: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [entries, setEntries] = useState<CoverageEntry[]>([]);
  const [dealTypes, setDealTypes] = useState<string[]>([]);
  const [gst, setGst] = useState("");
  const [udyam, setUdyam] = useState("");
  const [rera, setRera] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const gstErr = gst ? validateRegId("gst", gst) : null;
  const udyamErr = udyam ? validateRegId("udyam", udyam) : null;
  const reraErr = rera ? validateRegId("rera", rera) : null;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy]);

  async function submit() {
    setError(null);
    if (businessName.trim().length < 2) return setError("Enter a business name.");
    const coverageCities = entries.map((e) => e.cityId);
    if (coverageCities.length === 0) return setError("Add at least one coverage city.");
    if (gstErr || udyamErr || reraErr) return setError(gstErr ?? udyamErr ?? reraErr);
    const coverageLocalities = entries.flatMap((e) => e.localities.map((l) => l.localityId));

    setBusy(true);
    try {
      await apiFetch(`/api/admin/users/${userId}/convert-to-dealer`, {
        method: "POST",
        body: JSON.stringify({
          businessName: businessName.trim(),
          dealTypes,
          coverageCities,
          coverageLocalities,
          gstNumber: gst.trim() || undefined,
          udyamNumber: udyam.trim() || undefined,
          reraNumber: rera.trim() || undefined,
        }),
      });
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not convert this user.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-control border border-clay-300 bg-clay-50 px-2.5 py-1 text-meta font-medium text-clay-700 hover:bg-clay-100"
      >
        Convert to Dealer
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Convert user to dealer"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setOpen(false);
          }}
        >
          <div className="my-8 w-full max-w-lg rounded-card border border-border bg-surface p-5 shadow-lift">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink-950">Convert to dealer</h2>
                <p className="text-meta text-muted-foreground">
                  Creates an <b>active</b> dealer linked to this user.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !busy && setOpen(false)}
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
                <p className="text-sm font-medium text-ink-950">Dealer created.</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-1 rounded-control border border-border px-3 py-1.5 text-sm font-medium text-ink-800 hover:bg-surface-muted"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <Labeled label="Name">
                    <input value={userName || "—"} disabled className="h-9 w-full rounded-control border border-border bg-surface-muted px-2 text-sm" />
                  </Labeled>
                  <Labeled label="Phone (read-only)">
                    <input value={`+${userPhone}`} disabled className="h-9 w-full rounded-control border border-border bg-surface-muted px-2 text-sm" />
                  </Labeled>
                </div>

                <Labeled label="Business name *">
                  <input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    maxLength={160}
                    className="h-9 w-full rounded-control border border-border bg-background px-2 text-sm"
                  />
                </Labeled>

                <div className="flex flex-col gap-2">
                  <span className="text-meta text-muted-foreground">Deal types</span>
                  <div className="flex flex-wrap gap-3">
                    {DEAL_TYPES.map((d) => (
                      <label key={d.value} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={dealTypes.includes(d.value)}
                          onChange={(e) =>
                            setDealTypes((cur) =>
                              e.target.checked ? [...cur, d.value] : cur.filter((x) => x !== d.value),
                            )
                          }
                          className="accent-clay-600"
                        />
                        {d.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-meta text-muted-foreground">Coverage area *</span>
                  <CoverageEditor entries={entries} onChange={setEntries} />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <RegField label="GST" value={gst} err={gstErr} onChange={(v) => setGst(normalizeRegId(v))} />
                  <RegField label="Udyam" value={udyam} err={udyamErr} onChange={(v) => setUdyam(normalizeRegId(v))} />
                  <RegField label="RERA" value={rera} err={reraErr} onChange={(v) => setRera(normalizeRegId(v))} hint={RERA_HELP} />
                </div>

                {error && <p className="text-sm text-danger-700">{error}</p>}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={busy}
                    className="rounded-control border border-border px-3 py-2 text-sm font-medium text-ink-800 hover:bg-surface-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Store className="size-4" />}
                    Create dealer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-meta text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function RegField({
  label,
  value,
  err,
  hint,
  onChange,
}: {
  label: string;
  value: string;
  err?: string | null;
  hint?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-meta text-muted-foreground">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={40}
        className={
          "h-9 w-full rounded-control border bg-background px-2 text-sm " +
          (err ? "border-danger-500" : "border-border")
        }
      />
      {err ? <span className="text-danger-700">{err}</span> : hint ? <span>{hint}</span> : null}
    </label>
  );
}
