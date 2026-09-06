"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PriceInput } from "@/components/ui/price-input";
import { ImageUploader } from "@/components/shared/image-uploader";
import { MapPicker } from "@/components/shared/map-picker";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { validateRegId, normalizeRegId, RERA_HELP } from "@/lib/validation/registration-ids";
import type { UploadedImage } from "@/types/media";
import type { MyDealer } from "@/lib/dealers/account";

const DEAL_TYPES = [
  { value: "plot", label: "Plots" },
  { value: "flat", label: "Flats" },
  { value: "house", label: "Houses" },
  { value: "commercial", label: "Commercial" },
  { value: "rent", label: "Rentals" },
  { value: "resale", label: "Resale" },
];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface Hours {
  day: string;
  open: string;
  close: string;
  closed: boolean;
}

const numOrNull = (s: string): number | null => {
  const n = Number(s);
  return s.trim() && !Number.isNaN(n) ? n : null;
};
const toImg = (img?: { url: string; publicId?: string }): UploadedImage[] =>
  img?.url ? [{ url: img.url, publicId: img.publicId ?? "", width: 1200, height: 630 }] : [];

/** The dealer's public-profile editor (Phase 4). Verification status, the badge
 *  and verificationDocs are NOT here — they're admin-only / upload-only. */
export function DealerProfileEditor({ dealer }: { dealer: MyDealer }) {
  const router = useRouter();
  const p = dealer.profile;

  const [banner, setBanner] = useState<UploadedImage[]>(toImg(p.bannerImage));
  const [logo, setLogo] = useState<UploadedImage[]>(toImg(p.logoImage));
  const [tagline, setTagline] = useState(p.tagline ?? "");
  const [about, setAbout] = useState(p.about ?? "");
  const [establishedYear, setEstablishedYear] = useState(p.establishedYear?.toString() ?? "");
  const [yearsExperience, setYearsExperience] = useState(p.yearsExperience?.toString() ?? "");
  const [teamSize, setTeamSize] = useState(p.teamSize?.toString() ?? "");
  const [dealTypes, setDealTypes] = useState<string[]>(p.dealTypes);
  const [languages, setLanguages] = useState(p.languages.join(", "));
  const [priceMin, setPriceMin] = useState(p.priceRangeMin?.toString() ?? "");
  const [priceMax, setPriceMax] = useState(p.priceRangeMax?.toString() ?? "");
  const [reraNumber, setReraNumber] = useState(p.reraNumber ?? "");
  const [gstNumber, setGstNumber] = useState(p.gstNumber ?? "");
  const [officeAddress, setOfficeAddress] = useState(p.officeAddress ?? "");
  const [mapLat, setMapLat] = useState(p.mapLat?.toString() ?? "");
  const [mapLng, setMapLng] = useState(p.mapLng?.toString() ?? "");
  const [publicEmail, setPublicEmail] = useState(p.publicEmail ?? "");
  const [publicEmailOptIn, setPublicEmailOptIn] = useState(p.publicEmailOptIn);
  const [publicPhoneOptIn, setPublicPhoneOptIn] = useState(p.publicPhoneOptIn);
  const [hours, setHours] = useState<Hours[]>(
    DAYS.map((day) => {
      const existing = p.workingHours.find((h) => h.day === day);
      return {
        day,
        open: existing?.open ?? "09:00",
        close: existing?.close ?? "18:00",
        closed: existing?.closed ?? false,
      };
    }),
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Bumped when the office-address field blurs, to forward-geocode + move the pin.
  const [geoNonce, setGeoNonce] = useState(0);

  const reraError = reraNumber ? validateRegId("rera", reraNumber) : null;
  const gstError = gstNumber ? validateRegId("gst", gstNumber) : null;

  function toggleDeal(v: string, on: boolean) {
    setDealTypes((cur) => (on ? [...cur, v] : cur.filter((x) => x !== v)));
  }
  function setHour(i: number, patch: Partial<Hours>) {
    setHours((cur) => cur.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (reraError || gstError) {
      setError(reraError ?? gstError);
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await apiFetch(`/api/dealers/${dealer.id}/profile`, {
        method: "PATCH",
        body: JSON.stringify({
          tagline: tagline.trim(),
          about,
          establishedYear: numOrNull(establishedYear),
          yearsExperience: numOrNull(yearsExperience),
          teamSize: numOrNull(teamSize),
          dealTypes,
          languages: languages
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          priceRangeMin: numOrNull(priceMin),
          priceRangeMax: numOrNull(priceMax),
          reraNumber: reraNumber.trim(),
          gstNumber: gstNumber.trim(),
          officeAddress: officeAddress.trim(),
          mapLat: numOrNull(mapLat),
          mapLng: numOrNull(mapLng),
          workingHours: hours,
          publicEmail: publicEmail.trim(),
          publicEmailOptIn,
          publicPhoneOptIn,
          bannerImage: banner[0] ? { url: banner[0].url, publicId: banner[0].publicId } : null,
          logoImage: logo[0] ? { url: logo[0].url, publicId: logo[0].publicId } : null,
        }),
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      {/* Branding */}
      <Section title="Branding">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Logo</Label>
            <ImageUploader folder="dealers" value={logo} onChange={setLogo} maxCount={1} minCount={0} />
          </div>
          <div>
            <Label>Banner</Label>
            <ImageUploader folder="dealers" value={banner} onChange={setBanner} maxCount={1} minCount={0} />
          </div>
        </div>
      </Section>

      {/* Business */}
      <Section title="Business">
        <Field label="Tagline">
          <Input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={120} placeholder="One line about your business" />
        </Field>
        <Field label="About" hint="Basic formatting is allowed and sanitized. Up to 2000 characters.">
          <Textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={6} placeholder="Tell buyers who you are, your experience, and how you work." />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Established year"><NumInput value={establishedYear} onChange={setEstablishedYear} /></Field>
          <Field label="Years of experience"><NumInput value={yearsExperience} onChange={setYearsExperience} /></Field>
          <Field label="Team size"><NumInput value={teamSize} onChange={setTeamSize} /></Field>
        </div>
      </Section>

      {/* Offering */}
      <Section title="What you deal in">
        <div className="flex flex-wrap gap-3">
          {DEAL_TYPES.map((d) => (
            <label key={d.value} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={dealTypes.includes(d.value)}
                onCheckedChange={(c) => toggleDeal(d.value, Boolean(c))}
              />
              {d.label}
            </label>
          ))}
        </div>
        <p className="text-meta text-muted-foreground">
          Service areas come from your coverage cities/localities below.
        </p>
      </Section>

      {/* Details */}
      <Section title="Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Price range from"><PriceInput value={priceMin} onChange={setPriceMin} /></Field>
          <Field label="Price range to"><PriceInput value={priceMax} onChange={setPriceMax} /></Field>
          <Field label="RERA number" hint={RERA_HELP}>
            <Input
              value={reraNumber}
              onChange={(e) => setReraNumber(normalizeRegId(e.target.value))}
              invalid={Boolean(reraError)}
              maxLength={40}
            />
            {reraError && <p className="text-meta text-danger-700">{reraError}</p>}
          </Field>
          <Field label="GST number">
            <Input
              value={gstNumber}
              onChange={(e) => setGstNumber(normalizeRegId(e.target.value))}
              invalid={Boolean(gstError)}
              maxLength={40}
            />
            {gstError && <p className="text-meta text-danger-700">{gstError}</p>}
          </Field>
          <Field label="Languages" hint="Comma-separated"><Input value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="Hindi, English" /></Field>
        </div>
      </Section>

      {/* Contact */}
      <Section title="Contact & hours">
        <Field label="Office address" hint="Type to move the pin, drag it, or use your current location.">
          <Input
            value={officeAddress}
            onChange={(e) => setOfficeAddress(e.target.value)}
            onBlur={() => officeAddress.trim() && setGeoNonce((n) => n + 1)}
            maxLength={300}
          />
        </Field>
        <Field label="Pin your office on the map">
          <MapPicker
            value={mapLat && mapLng ? { lat: Number(mapLat), lng: Number(mapLng) } : null}
            onChange={(lat, lng) => {
              setMapLat(String(lat));
              setMapLng(String(lng));
            }}
            onResolveAddress={(addr) => setOfficeAddress(addr)}
            geocodeQuery={officeAddress}
            geocodeNonce={geoNonce}
          />
        </Field>

        <div className="flex flex-col gap-1.5">
          <Label>Working hours</Label>
          <div className="flex flex-col gap-1.5">
            {hours.map((h, i) => (
              <div key={h.day} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-24 text-muted-foreground">{h.day}</span>
                <label className="flex items-center gap-1.5">
                  <Checkbox checked={h.closed} onCheckedChange={(c) => setHour(i, { closed: Boolean(c) })} /> Closed
                </label>
                {!h.closed && (
                  <>
                    <Input type="time" value={h.open} onChange={(e) => setHour(i, { open: e.target.value })} className="w-32" />
                    <span>–</span>
                    <Input type="time" value={h.close} onChange={(e) => setHour(i, { close: e.target.value })} className="w-32" />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <Field label="Public email" hint="Shown only if you enable it below.">
          <Input type="email" value={publicEmail} onChange={(e) => setPublicEmail(e.target.value)} maxLength={200} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={publicEmailOptIn} onCheckedChange={(c) => setPublicEmailOptIn(Boolean(c))} />
          Show my email publicly
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={publicPhoneOptIn} onCheckedChange={(c) => setPublicPhoneOptIn(Boolean(c))} />
          Show my phone number (+{dealer.phone}) publicly
        </label>
      </Section>

      {error && <p className="text-sm text-danger-700">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy} size="lg">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Save profile
        </Button>
        {saved && <span className="text-meta text-success-700">Saved.</span>}
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-border bg-surface p-5">
      <h2 className="mb-3 text-sm font-semibold text-ink-950">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-meta text-muted-foreground">{hint}</p>}
    </div>
  );
}

function NumInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
