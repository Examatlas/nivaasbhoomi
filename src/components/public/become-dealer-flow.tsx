"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Store, ArrowRight } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

/** Buyer → dealer upgrade: a confirm step, then the registration form. Name and
 *  phone are prefilled from the buyer account; phone is not editable. */
export function BecomeDealerFlow({ name, phone }: { name: string; phone: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"confirm" | "form">("confirm");

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

  if (step === "confirm") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-clay-50 text-clay-700">
          <Store className="size-6" />
        </span>
        <div>
          <h1 className="text-display-sm">Become a dealer</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This number is already registered as a buyer account. Would you like to upgrade it to a
            dealer account and list your properties?
          </p>
        </div>
        <div className="mt-2 flex gap-3">
          <Button variant="ghost" onClick={() => router.push("/")}>
            Cancel
          </Button>
          <Button onClick={() => setStep("form")}>
            Continue <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

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
      router.replace("/dealer/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not create your dealer account.");
    } finally {
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
