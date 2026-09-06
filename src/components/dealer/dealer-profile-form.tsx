"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/components/shared/image-uploader";
import { CoverageEditor, type CoverageEntry } from "@/components/dealer/coverage-editor";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import type { UploadedImage } from "@/types/media";
import type { MyDealer } from "@/lib/dealers/account";

const PLACEHOLDER_RE = /^Dealer \d{4}$/;

export function DealerProfileForm({
  dealer,
  mode,
}: {
  dealer: MyDealer;
  mode: "onboarding" | "edit";
}) {
  const router = useRouter();

  const [name, setName] = useState(PLACEHOLDER_RE.test(dealer.name) ? "" : dealer.name);
  const [businessName, setBusinessName] = useState(
    PLACEHOLDER_RE.test(dealer.businessName) ? "" : dealer.businessName,
  );
  const [photo, setPhoto] = useState<UploadedImage[]>(
    dealer.profilePhoto
      ? [{ url: dealer.profilePhoto, publicId: "", width: 400, height: 400 }]
      : [],
  );
  const [entries, setEntries] = useState<CoverageEntry[]>(
    dealer.coverage.map((c) => ({
      cityId: c.cityId,
      cityName: c.cityName,
      localities: c.localities,
    })),
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (name.trim().length < 2 || businessName.trim().length < 2) {
      setError("Please enter your name and business name.");
      return;
    }
    const coverageCities = entries.map((x) => x.cityId);
    const coverageLocalities = entries.flatMap((x) =>
      x.localities.map((l) => l.localityId),
    );
    if (coverageCities.length === 0) {
      setError("Add at least one coverage city so leads can reach you.");
      return;
    }

    setBusy(true);
    try {
      await apiFetch(`/api/dealers/${dealer.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          businessName: businessName.trim(),
          profilePhoto: photo[0]?.url ?? "",
          coverageCities,
          coverageLocalities,
        }),
      });
      setSaved(true);
      if (mode === "onboarding") {
        router.replace("/dealer/dashboard");
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Could not save. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-ink-950">Profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name" required>
              Your name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="businessName" required>
              Business name
            </Label>
            <Input
              id="businessName"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Ranchi Prime Properties"
              required
            />
          </div>
        </div>
        <p className="text-meta text-muted-foreground">
          Manage your account email and phone number under{" "}
          <span className="font-medium text-ink-800">Account details</span> below.
        </p>

        <div className="flex flex-col gap-1.5">
          <Label>Profile photo</Label>
          <ImageUploader
            folder="dealers"
            value={photo}
            onChange={setPhoto}
            maxCount={1}
            minCount={0}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-950">Coverage area</h2>
          <p className="text-sm text-muted-foreground">
            The cities and localities you serve. Leads are routed on this - you can
            change it anytime.
          </p>
        </div>
        <CoverageEditor
          entries={entries}
          onChange={(next) => setEntries(next)}
        />
      </section>

      {error && <p className="text-sm text-danger-700">{error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy} size="lg">
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : saved ? (
            <Check className="size-4" />
          ) : null}
          {mode === "onboarding" ? "Finish setup" : "Save changes"}
        </Button>
        {saved && mode === "edit" && (
          <span className="text-sm text-success-700">Saved.</span>
        )}
      </div>
    </form>
  );
}
