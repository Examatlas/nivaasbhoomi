"use client";

import { useState } from "react";
import { Loader2, Store } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CoverageEditor, type CoverageEntry } from "@/components/dealer/coverage-editor";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { hardNavigate } from "@/lib/auth/auth-nav";
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
 * The single dealer registration form — shared by the buyer→dealer upgrade
 * (become-dealer) AND dealer self-signup (/dealer/register). Name and phone come
 * from the already-verified account and are not editable. Submits to
 * /api/users/me/upgrade, which creates a "pending" Dealer, links both sides and
 * emails an admin. On success → the dealer dashboard (with its pending banner).
 */
export function DealerRegistrationForm({
  name,
  phone,
  mode = "new",
}: {
  name: string;
  phone: string;
  /** "upgrade" = an existing buyer account is becoming a dealer (link, don't
   *  duplicate); "new" = a freshly-created number. Only changes the notice. */
  mode?: "upgrade" | "new";
}) {
  const [businessName, setBusinessName] = useState("");
  const [dealTypes, setDealTypes] = useState<string[]>([]);
  const [entries, setEntries] = useState<CoverageEntry[]>([]);
  const [gst, setGst] = useState("");
  const [udyam, setUdyam] = useState("");
  const [rera, setRera] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gstErr = gst ? validateRegId("gst", gst) : null;
  const udyamErr = udyam ? validateRegId("udyam", udyam) : null;
  const reraErr = rera ? validateRegId("rera", rera) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (businessName.trim().length < 2) return setError("Enter your business name.");
    const coverageCities = entries.map((x) => x.cityId);
    if (coverageCities.length === 0) return setError("Add at least one coverage city.");
    if (gstErr || udyamErr || reraErr) return setError(gstErr ?? udyamErr ?? reraErr);

    const coverageLocalities = entries.flatMap((x) => x.localities.map((l) => l.localityId));
    setBusy(true);
    try {
      await apiFetch("/api/users/me/upgrade", {
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
      // HARD navigation so the dashboard renders with the freshly-set dealer
      // session (pending banner, etc.). Keep the button spinning until unload.
      hardNavigate("/dealer/dashboard");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not create your dealer account.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div>
        <h1 className="text-display-sm">Dealer registration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account will be reviewed by our team before it goes live.
        </p>
      </div>

      {mode === "upgrade" && (
        <div className="rounded-card border border-clay-100 bg-clay-50 px-4 py-3 text-sm text-clay-800">
          This number is already linked to your account. You&apos;re upgrading it to a{" "}
          <b>dealer</b> account — your existing details stay the same.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Your name</Label>
          <Input value={name || "—"} disabled />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Phone (login number)</Label>
          <Input value={`+${phone}`} disabled />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label required>Business name</Label>
        <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} maxLength={160} />
      </div>

      <div className="flex flex-col gap-2">
        <Label>What do you deal in?</Label>
        <div className="flex flex-wrap gap-3">
          {DEAL_TYPES.map((d) => (
            <label key={d.value} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={dealTypes.includes(d.value)}
                onCheckedChange={(c) =>
                  setDealTypes((cur) => (c ? [...cur, d.value] : cur.filter((x) => x !== d.value)))
                }
              />
              {d.label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label required>Coverage area</Label>
        <CoverageEditor entries={entries} onChange={setEntries} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="GST number (optional)" err={gstErr}>
          <Input value={gst} onChange={(e) => setGst(normalizeRegId(e.target.value))} invalid={Boolean(gstErr)} maxLength={40} />
        </Field>
        <Field label="Udyam number (optional)" err={udyamErr}>
          <Input value={udyam} onChange={(e) => setUdyam(normalizeRegId(e.target.value))} invalid={Boolean(udyamErr)} maxLength={40} />
        </Field>
        <Field label="RERA number (optional)" err={reraErr} hint={RERA_HELP}>
          <Input value={rera} onChange={(e) => setRera(normalizeRegId(e.target.value))} invalid={Boolean(reraErr)} maxLength={40} />
        </Field>
      </div>

      {error && <p className="text-sm text-danger-700">{error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy} size="lg">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Store className="size-4" />}
          Submit for approval
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  err,
  hint,
  children,
}: {
  label: string;
  err?: string | null;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {err && <p className="text-meta text-danger-700">{err}</p>}
      {hint && !err && <p className="text-meta text-muted-foreground">{hint}</p>}
    </div>
  );
}
