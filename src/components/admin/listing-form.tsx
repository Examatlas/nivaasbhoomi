"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ImageUploader } from "@/components/shared/image-uploader";
import {
  CascadingLocation,
  type LocationValue,
} from "@/components/admin/cascading-location";
import { DealerPicker } from "@/components/admin/dealer-picker";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { listingFolder } from "@/lib/media/transforms";
import { PROPERTY_TYPES, BHK_OPTIONS } from "@/types/admin-listings";
import type { UploadedImage } from "@/types/media";

type Str = Record<string, string>;

const num = (s: string): number | undefined => {
  if (s.trim() === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};
const csv = (s: string): string[] | undefined => {
  const arr = s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return arr.length ? arr : undefined;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="mb-4 text-lg font-semibold text-ink-950">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </Card>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label required={required}>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

/** Admin manual listing entry (create). Covers the full Section 4 model with
 *  Section 13 conditional logic. Coordinates are entered numerically for now;
 *  a map pin picker is a later enhancement. */
export function ListingForm() {
  const router = useRouter();

  const [dealerId, setDealerId] = useState("");
  const [loc, setLoc] = useState<LocationValue>({
    stateId: "",
    cityId: "",
    localityId: "",
  });
  const [purpose, setPurpose] = useState<"sale" | "rent">("sale");
  const [propertyType, setPropertyType] = useState("flat");
  const [status, setStatus] = useState<"pending" | "approved">("pending");
  const [photos, setPhotos] = useState<UploadedImage[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [f, setF] = useState<Str>({});
  const [states, setStates] = useState<{ _id: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const set = (key: string) => (v: string) => setF((prev) => ({ ...prev, [key]: v }));
  const g = (key: string) => f[key] ?? "";

  const isPlot = propertyType === "plot";
  const isUnderConstruction = g("possessionStatus") === "under-construction";

  useEffect(() => {
    apiFetch<{ _id: string; name: string }[]>("/api/locations/states")
      .then(setStates)
      .catch(() => setStates([]));
  }, []);

  // For a listing folder we need slugs; the location APIs return names, so we
  // build the folder from the selected ids as a stable, slug-safe path.
  const folder =
    loc.cityId && loc.localityId
      ? listingFolder(loc.cityId.slice(-6), loc.localityId.slice(-6))
      : "listings/misc/misc";

  async function submit() {
    setSubmitting(true);
    setFieldErrors({});

    const body: Record<string, unknown> = {
      dealerId,
      stateId: loc.stateId,
      cityId: loc.cityId,
      localityId: loc.localityId,
      purpose,
      propertyType,
      status,
      title: g("title"),
      description: g("description"),
      lat: num(g("lat")),
      lng: num(g("lng")),
      subLocality: g("subLocality") || undefined,
      projectName: g("projectName") || undefined,
      landmark: g("landmark") || undefined,
      fullAddress: g("fullAddress") || undefined,
      pincode: g("pincode") || undefined,
      bathrooms: isPlot ? undefined : num(g("bathrooms")),
      balconies: num(g("balconies")),
      carpetArea: num(g("carpetArea")),
      builtUpArea: num(g("builtUpArea")),
      plotArea: num(g("plotArea")),
      floor: isPlot ? undefined : num(g("floor")),
      totalFloors: num(g("totalFloors")),
      facing: g("facing") || undefined,
      ageOfProperty: g("ageOfProperty") || undefined,
      furnishing: g("furnishing") || undefined,
      furnishingDetails: csv(g("furnishingDetails")),
      amenities: csv(g("amenities")),
      parking: g("parking") || undefined,
      waterSource: csv(g("waterSource")),
      maintenanceCharge: num(g("maintenanceCharge")),
      brokerage: g("brokerage") || undefined,
      possessionStatus: g("possessionStatus") || undefined,
      ownershipType: g("ownershipType") || undefined,
      metaTitle: g("metaTitle") || undefined,
      metaDescription: g("metaDescription") || undefined,
      photos,
      coverPhotoIndex: coverIndex,
    };

    if (!isPlot) body.bhk = g("bhk") || undefined;

    if (purpose === "sale") {
      body.expectedPrice = num(g("expectedPrice"));
      body.priceNegotiable = f["priceNegotiable"] === "yes";
      body.bookingAmount = num(g("bookingAmount"));
    } else {
      body.monthlyRent = num(g("monthlyRent"));
      body.securityDeposit = num(g("securityDeposit"));
      body.rentNegotiable = f["rentNegotiable"] === "yes";
      body.preferredTenant = csv(g("preferredTenant"));
      body.minLeasePeriod = g("minLeasePeriod") || undefined;
    }

    if (isUnderConstruction) {
      body.reraNumber = g("reraNumber") || undefined;
      body.reraStateId = g("reraStateId") || undefined;
    }

    try {
      const res = await apiFetch<{ _id: string }>("/api/admin/listings", {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast.success("Listing created");
      router.push(`/admin/listings/${res._id}`);
    } catch (e) {
      if (e instanceof ApiClientError) {
        const details = e.details as
          { fieldErrors?: Record<string, string[]> } | undefined;
        if (details?.fieldErrors) setFieldErrors(details.fieldErrors);
        toast.error(e.message);
      } else {
        toast.error("Could not create the listing.");
      }
      setSubmitting(false);
    }
  }

  const errorText = (key: string) =>
    fieldErrors[key] ? (
      <span className="text-meta text-danger-600">{fieldErrors[key]!.join(" ")}</span>
    ) : null;

  return (
    <div className="flex flex-col gap-6 pb-10">
      <Section title="Owner">
        <div className="flex flex-col gap-1.5">
          <Label required>Dealer</Label>
          <DealerPicker value={dealerId} onChange={(id) => setDealerId(id)} />
          {errorText("dealerId")}
        </div>
      </Section>

      <Section title="Location">
        <CascadingLocation value={loc} onChange={setLoc} />
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Latitude"
            value={g("lat")}
            onChange={set("lat")}
            required
            placeholder="23.36"
          />
          <TextField
            label="Longitude"
            value={g("lng")}
            onChange={set("lng")}
            required
            placeholder="85.33"
          />
          <TextField
            label="Pincode"
            value={g("pincode")}
            onChange={set("pincode")}
            placeholder="834008"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Sub-locality"
            value={g("subLocality")}
            onChange={set("subLocality")}
          />
          <TextField
            label="Project name"
            value={g("projectName")}
            onChange={set("projectName")}
          />
          <TextField label="Landmark" value={g("landmark")} onChange={set("landmark")} />
          <TextField
            label="Full address (never shown publicly)"
            value={g("fullAddress")}
            onChange={set("fullAddress")}
          />
        </div>
      </Section>

      <Section title="Basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label required>Purpose</Label>
            <Select
              value={purpose}
              onValueChange={(v) => setPurpose(v as "sale" | "rent")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sale">Sale</SelectItem>
                <SelectItem value="rent">Rent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label required>Property type</Label>
            <Select value={propertyType} onValueChange={setPropertyType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <TextField
          label="Title"
          value={g("title")}
          onChange={set("title")}
          required
          placeholder="Spacious 3 BHK near Kanke Road"
        />
        {errorText("title")}
        <div className="flex flex-col gap-1.5">
          <Label required>
            Description{" "}
            <span className="text-meta font-normal text-subtle-foreground">
              ({g("description").trim().length}/100 min)
            </span>
          </Label>
          <Textarea
            value={g("description")}
            onChange={(e) => set("description")(e.target.value)}
            rows={5}
          />
          {errorText("description")}
        </div>
      </Section>

      <Section title="Details">
        <div className="grid gap-4 sm:grid-cols-3">
          {!isPlot && (
            <div className="flex flex-col gap-1.5">
              <Label>BHK</Label>
              <Select value={g("bhk") || undefined} onValueChange={set("bhk")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {BHK_OPTIONS.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {!isPlot && (
            <TextField
              label="Bathrooms"
              value={g("bathrooms")}
              onChange={set("bathrooms")}
              type="number"
            />
          )}
          <TextField
            label="Balconies"
            value={g("balconies")}
            onChange={set("balconies")}
            type="number"
          />
          <TextField
            label="Carpet area (sq.ft.)"
            value={g("carpetArea")}
            onChange={set("carpetArea")}
            type="number"
          />
          <TextField
            label="Built-up area (sq.ft.)"
            value={g("builtUpArea")}
            onChange={set("builtUpArea")}
            type="number"
          />
          <TextField
            label="Plot area (sq.ft.)"
            value={g("plotArea")}
            onChange={set("plotArea")}
            type="number"
          />
          {!isPlot && (
            <TextField
              label="Floor"
              value={g("floor")}
              onChange={set("floor")}
              type="number"
            />
          )}
          <TextField
            label="Total floors"
            value={g("totalFloors")}
            onChange={set("totalFloors")}
            type="number"
          />
          <TextField
            label="Facing"
            value={g("facing")}
            onChange={set("facing")}
            placeholder="North-East"
          />
          <TextField
            label="Age of property"
            value={g("ageOfProperty")}
            onChange={set("ageOfProperty")}
            placeholder="0-5 years"
          />
        </div>
        {isPlot && (
          <p className="text-meta text-muted-foreground">
            BHK, bathrooms and floor are hidden for plots (Section 13).
          </p>
        )}
      </Section>

      <Section title="Furnishing & amenities">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Furnishing</Label>
            <Select
              value={g("furnishing") || undefined}
              onValueChange={set("furnishing")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="furnished">Furnished</SelectItem>
                <SelectItem value="semi-furnished">Semi-furnished</SelectItem>
                <SelectItem value="unfurnished">Unfurnished</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <TextField
            label="Parking"
            value={g("parking")}
            onChange={set("parking")}
            placeholder="1 covered"
          />
          <TextField
            label="Furnishing details (comma-separated)"
            value={g("furnishingDetails")}
            onChange={set("furnishingDetails")}
            placeholder="AC, Wardrobe, Modular kitchen"
          />
          <TextField
            label="Amenities (comma-separated)"
            value={g("amenities")}
            onChange={set("amenities")}
            placeholder="Lift, Power backup, Gym"
          />
          <TextField
            label="Water source (comma-separated)"
            value={g("waterSource")}
            onChange={set("waterSource")}
            placeholder="Municipal, Borewell"
          />
        </div>
      </Section>

      <Section title={purpose === "sale" ? "Price (sale)" : "Price (rent)"}>
        {purpose === "sale" ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <TextField
                label="Expected price (₹)"
                value={g("expectedPrice")}
                onChange={set("expectedPrice")}
                type="number"
                required
              />
              {errorText("expectedPrice")}
            </div>
            <TextField
              label="Booking amount (₹)"
              value={g("bookingAmount")}
              onChange={set("bookingAmount")}
              type="number"
            />
            <div className="flex flex-col gap-1.5">
              <Label>Negotiable</Label>
              <Select
                value={f["priceNegotiable"] ?? "no"}
                onValueChange={set("priceNegotiable")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <TextField
                label="Monthly rent (₹)"
                value={g("monthlyRent")}
                onChange={set("monthlyRent")}
                type="number"
                required
              />
              {errorText("monthlyRent")}
            </div>
            <TextField
              label="Security deposit (₹)"
              value={g("securityDeposit")}
              onChange={set("securityDeposit")}
              type="number"
            />
            <TextField
              label="Min lease period"
              value={g("minLeasePeriod")}
              onChange={set("minLeasePeriod")}
              placeholder="11 months"
            />
            <TextField
              label="Preferred tenant (comma-separated)"
              value={g("preferredTenant")}
              onChange={set("preferredTenant")}
              placeholder="Family, Bachelors"
            />
            <div className="flex flex-col gap-1.5">
              <Label>Negotiable</Label>
              <Select
                value={f["rentNegotiable"] ?? "no"}
                onValueChange={set("rentNegotiable")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Maintenance charge (₹/mo)"
            value={g("maintenanceCharge")}
            onChange={set("maintenanceCharge")}
            type="number"
          />
          <TextField
            label="Brokerage (shown publicly)"
            value={g("brokerage")}
            onChange={set("brokerage")}
            placeholder="No brokerage / 1 month"
          />
        </div>
      </Section>

      <Section title="Legal">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Possession status</Label>
            <Select
              value={g("possessionStatus") || undefined}
              onValueChange={set("possessionStatus")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ready-to-move">Ready to move</SelectItem>
                <SelectItem value="under-construction">Under construction</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <TextField
            label="Ownership type"
            value={g("ownershipType")}
            onChange={set("ownershipType")}
            placeholder="Freehold"
          />
          {isUnderConstruction && (
            <>
              <div>
                <TextField
                  label="RERA number"
                  value={g("reraNumber")}
                  onChange={set("reraNumber")}
                  required
                />
                {errorText("reraNumber")}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label required>RERA state</Label>
                <Select
                  value={g("reraStateId") || undefined}
                  onValueChange={set("reraStateId")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map((s) => (
                      <SelectItem key={s._id} value={s._id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errorText("reraStateId")}
              </div>
            </>
          )}
        </div>
        {isUnderConstruction && (
          <p className="text-meta text-muted-foreground">
            Under-construction listings require a RERA number and state (Section 13).
          </p>
        )}
      </Section>

      <Section title="Photos">
        <ImageUploader
          folder={folder}
          value={photos}
          onChange={setPhotos}
          coverIndex={coverIndex}
          onCoverChange={setCoverIndex}
        />
        {errorText("photos")}
      </Section>

      <Section title="SEO (optional)">
        <TextField
          label="Meta title"
          value={g("metaTitle")}
          onChange={set("metaTitle")}
        />
        <TextField
          label="Meta description"
          value={g("metaDescription")}
          onChange={set("metaDescription")}
        />
      </Section>

      <div className="sticky bottom-4 flex items-center justify-between gap-4 rounded-card border border-border bg-surface/95 p-4 shadow-lift backdrop-blur">
        <div className="flex items-center gap-2">
          <Label className="mb-0">File as</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as "pending" | "approved")}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending review</SelectItem>
              <SelectItem value="approved">Approved (live)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="lg" onClick={submit} disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" />} Create listing
        </Button>
      </div>
    </div>
  );
}
