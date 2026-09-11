"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller, type Control, type UseFormRegisterReturn } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Loader2, Check, ChevronLeft, ChevronRight, AlertCircle, ArrowRight } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ImageUploader } from "@/components/shared/image-uploader";
import { PriceInput } from "@/components/ui/price-input";
import { MapPicker } from "@/components/shared/map-picker";
import { LocationPicker, type LocationValue } from "@/components/shared/location-picker";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { listingFolder } from "@/lib/media/transforms";
import { formatListingPrice } from "@/lib/utils/price";
import type { UploadedImage } from "@/types/media";

const STEPS = [
  "Basic",
  "Location",
  "Property details",
  "Furnishing & amenities",
  "Price",
  "Possession & legal",
  "Media",
  "Review & submit",
] as const;

const PROPERTY_TYPES = [
  { value: "flat", label: "Flat / Apartment" },
  { value: "independent-house", label: "Independent House" },
  { value: "villa", label: "Villa" },
  { value: "plot", label: "Plot / Land" },
  { value: "commercial-shop", label: "Commercial Shop" },
  { value: "office", label: "Office" },
  { value: "pg", label: "PG" },
  { value: "warehouse", label: "Warehouse" },
  { value: "farmhouse", label: "Farm House" },
];
const BHKS = [
  { value: "1rk", label: "1 RK" },
  { value: "1", label: "1 BHK" },
  { value: "2", label: "2 BHK" },
  { value: "3", label: "3 BHK" },
  { value: "4", label: "4 BHK" },
  { value: "5plus", label: "5+ BHK" },
];
const FACING = ["East", "West", "North", "South", "North-East", "North-West", "South-East", "South-West"];
const AGE = ["New", "<1 year", "1-5 years", "5-10 years", "10+ years"];
const FURNISHING_DETAILS = ["AC", "Beds", "Wardrobe", "Sofa", "Fridge", "Washing Machine", "TV", "Modular Kitchen", "Geyser", "Curtains"];
const AMENITIES = ["Lift", "Power Backup", "24x7 Security", "CCTV", "Gym", "Swimming Pool", "Clubhouse", "Children's Park", "Gas Pipeline", "Rainwater Harvesting", "Visitor Parking", "Intercom"];
const WATER_SOURCES = ["Municipal", "Borewell", "Tanker"];
const TENANTS = ["Family", "Bachelors", "Company", "Any"];

/** A single unmet requirement, mapped to the step + field that fixes it. */
interface Issue {
  step: number;
  fieldId: string;
  label: string;
}

interface FormValues {
  purpose: "sale" | "rent";
  propertyType: string;
  isCntLand: boolean;
  title: string;
  description: string;
  subLocality?: string;
  projectName?: string;
  landmark?: string;
  fullAddress?: string;
  pincode?: string;
  bhk?: string;
  bathrooms?: number;
  balconies?: number;
  carpetArea?: number;
  builtUpArea?: number;
  superBuiltUpArea?: number;
  plotArea?: number;
  floor?: number;
  totalFloors?: number;
  facing?: string;
  ageOfProperty?: string;
  furnishing?: string;
  parking?: string;
  expectedPrice?: number;
  bookingAmount?: number;
  priceNegotiable?: boolean;
  monthlyRent?: number;
  securityDeposit?: number;
  rentNegotiable?: boolean;
  availableFrom?: string;
  minLeasePeriod?: string;
  maintenanceCharge?: number;
  brokerage?: string;
  possessionStatus?: string;
  possessionDate?: string;
  ownershipType?: string;
  reraNumber?: string;
}

export interface ListingWizardInitial extends Partial<FormValues> {
  id?: string;
  stateId?: string;
  cityId?: string;
  localityId?: string;
  reraStateId?: string;
  lat?: number;
  lng?: number;
  photos?: UploadedImage[];
  coverPhotoIndex?: number;
  furnishingDetails?: string[];
  amenities?: string[];
  waterSource?: string[];
  preferredTenant?: string[];
}

/**
 * Host-specific behaviour. The default (dealer) autosaves drafts to
 * /api/listings and submits for admin review. Staff reuse the same wizard but
 * publish directly for a fixed, in-scope dealer (no draft round-trips).
 */
export interface ListingWizardConfig {
  createEndpoint: string;
  extraPayload?: Record<string, unknown>;
  supportsDraft: boolean;
  doneHref: string;
  submitLabel: string;
  reviewNote: string;
  reviewReadyNote: string;
}

const DEALER_CONFIG: ListingWizardConfig = {
  createEndpoint: "/api/listings",
  supportsDraft: true,
  doneHref: "/dealer/listings?submitted=1",
  submitLabel: "Submit for review",
  reviewNote:
    "Review the essentials. On submit, your listing goes to admin review (status “pending”). It goes live once approved and you’re verified (Tier 1+).",
  reviewReadyNote: "Everything looks good — you can submit for review.",
};

export function ListingWizard({
  initial,
  config = DEALER_CONFIG,
}: {
  initial?: ListingWizardInitial;
  config?: ListingWizardConfig;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draftId, setDraftId] = useState<string | null>(initial?.id ?? null);

  const { register, control, watch, setValue, getValues } = useForm<FormValues>({
    defaultValues: {
      purpose: initial?.purpose ?? "sale",
      propertyType: initial?.propertyType ?? "flat",
      isCntLand: initial?.isCntLand ?? false,
      title: initial?.title ?? "",
      description: initial?.description ?? "",
      subLocality: initial?.subLocality,
      projectName: initial?.projectName,
      landmark: initial?.landmark,
      fullAddress: initial?.fullAddress,
      pincode: initial?.pincode,
      bhk: initial?.bhk,
      bathrooms: initial?.bathrooms,
      balconies: initial?.balconies,
      carpetArea: initial?.carpetArea,
      builtUpArea: initial?.builtUpArea,
      superBuiltUpArea: initial?.superBuiltUpArea,
      plotArea: initial?.plotArea,
      floor: initial?.floor,
      totalFloors: initial?.totalFloors,
      facing: initial?.facing,
      ageOfProperty: initial?.ageOfProperty,
      furnishing: initial?.furnishing,
      parking: initial?.parking,
      expectedPrice: initial?.expectedPrice,
      bookingAmount: initial?.bookingAmount,
      priceNegotiable: initial?.priceNegotiable,
      monthlyRent: initial?.monthlyRent,
      securityDeposit: initial?.securityDeposit,
      rentNegotiable: initial?.rentNegotiable,
      availableFrom: initial?.availableFrom?.slice(0, 10),
      minLeasePeriod: initial?.minLeasePeriod,
      maintenanceCharge: initial?.maintenanceCharge,
      brokerage: initial?.brokerage,
      possessionStatus: initial?.possessionStatus,
      possessionDate: initial?.possessionDate?.slice(0, 10),
      ownershipType: initial?.ownershipType,
      reraNumber: initial?.reraNumber,
    },
  });

  // Controlled bits that live outside RHF's register.
  const [loc, setLoc] = useState<LocationValue>({
    stateId: initial?.stateId ?? "",
    cityId: initial?.cityId ?? "",
    localityId: initial?.localityId ?? "",
  });
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initial?.lat != null && initial?.lng != null
      ? { lat: initial.lat, lng: initial.lng }
      : null,
  );
  const [reraStateId, setReraStateId] = useState(initial?.reraStateId ?? "");
  const [reraStates, setReraStates] = useState<{ _id: string; name: string }[]>([]);
  const [photos, setPhotos] = useState<UploadedImage[]>(initial?.photos ?? []);
  const [coverIndex, setCoverIndex] = useState(initial?.coverPhotoIndex ?? 0);
  const [furnishingDetails, setFurnishingDetails] = useState<string[]>(initial?.furnishingDetails ?? []);
  const [amenities, setAmenities] = useState<string[]>(initial?.amenities ?? []);
  const [waterSource, setWaterSource] = useState<string[]>(initial?.waterSource ?? []);
  const [preferredTenant, setPreferredTenant] = useState<string[]>(initial?.preferredTenant ?? []);

  // Locality request (pending).

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Once the dealer has reached Review (or tried to submit), surface the
  // per-step validation flags so they can see and jump to what's incomplete.
  const [showErrors, setShowErrors] = useState(false);

  const purpose = watch("purpose");
  const propertyType = watch("propertyType");
  const possessionStatus = watch("possessionStatus");
  const isPlot = propertyType === "plot";
  // The selected locality id — when the built-in "request locality" flow creates
  // a new (pending) locality, LocationPicker sets it here via onChange, and the
  // server files the listing as "pending-location" because that locality is
  // still status:"pending".
  const effectiveLocalityId = loc.localityId;

  // Live values needed to validate (RHF fields).
  const wTitle = watch("title");
  const wDescription = watch("description");
  const wExpectedPrice = watch("expectedPrice");
  const wMonthlyRent = watch("monthlyRent");
  const wReraNumber = watch("reraNumber");

  useEffect(() => {
    if (step === STEPS.length - 1) setShowErrors(true);
  }, [step]);

  // The single source of truth for "what still needs fixing", mapped to the
  // exact step + field so an error can jump the dealer straight there.
  const issues = useMemo<Issue[]>(() => {
    const list: Issue[] = [];
    const descLen = wDescription?.trim().length ?? 0;
    if (!wTitle || !wTitle.trim()) {
      list.push({ step: 0, fieldId: "field-title", label: "Add a listing title" });
    }
    if (descLen < 100) {
      list.push({
        step: 0,
        fieldId: "field-description",
        label: `Description needs at least 100 characters (${descLen}/100)`,
      });
    }
    if (!effectiveLocalityId) {
      list.push({ step: 1, fieldId: "field-locality", label: "Select or request a locality" });
    }
    if (!coords) {
      list.push({ step: 1, fieldId: "field-mappin", label: "Drop a map pin for the exact location" });
    }
    const priceOk = (n?: number) => typeof n === "number" && !Number.isNaN(n) && n > 0;
    if (purpose === "sale" && !priceOk(wExpectedPrice)) {
      list.push({ step: 4, fieldId: "field-expectedPrice", label: "Enter the expected price" });
    }
    if (purpose === "rent" && !priceOk(wMonthlyRent)) {
      list.push({ step: 4, fieldId: "field-monthlyRent", label: "Enter the monthly rent" });
    }
    if (possessionStatus === "under-construction") {
      if (!wReraNumber || !wReraNumber.trim()) {
        list.push({ step: 5, fieldId: "field-reraNumber", label: "Under-construction: RERA number is required" });
      }
      if (!reraStateId) {
        list.push({ step: 5, fieldId: "field-reraStateId", label: "Under-construction: RERA state is required" });
      }
    }
    if (photos.length < 1) {
      list.push({
        step: 6,
        fieldId: "field-photos",
        label: "Add at least 1 photo",
      });
    }
    return list;
  }, [
    wTitle,
    wDescription,
    wExpectedPrice,
    wMonthlyRent,
    wReraNumber,
    effectiveLocalityId,
    coords,
    purpose,
    possessionStatus,
    reraStateId,
    photos,
  ]);

  const stepsWithIssues = useMemo(() => new Set(issues.map((i) => i.step)), [issues]);

  /** Jump to the step owning a field, then scroll it into view, focus + flash it. */
  function goToField(targetStep: number, fieldId: string) {
    setShowErrors(true);
    setStep(targetStep);
    // Let the target step render before we look for the element.
    setTimeout(() => {
      const el = document.getElementById(fieldId);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const focusable =
        el.matches("input, textarea, select, button")
          ? el
          : el.querySelector<HTMLElement>("input, textarea, select, button, [tabindex]");
      (focusable as HTMLElement | null)?.focus?.({ preventScroll: true });
      el.classList.remove("nb-flash");
      // reflow so the animation can re-trigger if the same field is chosen twice
      void el.offsetWidth;
      el.classList.add("nb-flash");
      window.setTimeout(() => el.classList.remove("nb-flash"), 1900);
    }, 80);
  }

  // ---- build the API payload from current state ----
  function buildPayload(): Record<string, unknown> {
    const v = getValues();
    const num = (n?: number) => (typeof n === "number" && !Number.isNaN(n) ? n : undefined);
    const str = (s?: string) => (s && s.trim() ? s.trim() : undefined);
    const payload: Record<string, unknown> = {
      purpose: v.purpose,
      propertyType: v.propertyType,
      // Plots only; never carry the declaration on a non-plot type.
      isCntLand: v.propertyType === "plot" ? Boolean(v.isCntLand) : false,
      title: str(v.title),
      description: str(v.description),
      stateId: loc.stateId || undefined,
      cityId: loc.cityId || undefined,
      localityId: effectiveLocalityId || undefined,
      subLocality: str(v.subLocality),
      projectName: str(v.projectName),
      landmark: str(v.landmark),
      fullAddress: str(v.fullAddress),
      pincode: str(v.pincode),
      lat: coords?.lat,
      lng: coords?.lng,
      facing: str(v.facing),
      ageOfProperty: str(v.ageOfProperty),
      totalFloors: num(v.totalFloors),
      balconies: num(v.balconies),
      carpetArea: num(v.carpetArea),
      builtUpArea: num(v.builtUpArea),
      superBuiltUpArea: num(v.superBuiltUpArea),
      furnishing: str(v.furnishing),
      furnishingDetails,
      amenities,
      parking: str(v.parking),
      waterSource,
      maintenanceCharge: num(v.maintenanceCharge),
      brokerage: str(v.brokerage),
      possessionStatus: str(v.possessionStatus),
      possessionDate: str(v.possessionDate),
      ownershipType: str(v.ownershipType),
      photos,
      coverPhotoIndex: coverIndex,
    };
    if (!isPlot) {
      payload.bhk = str(v.bhk);
      payload.bathrooms = num(v.bathrooms);
      payload.floor = num(v.floor);
    } else {
      payload.plotArea = num(v.plotArea);
    }
    if (v.purpose === "sale") {
      payload.expectedPrice = num(v.expectedPrice);
      payload.bookingAmount = num(v.bookingAmount);
      payload.priceNegotiable = Boolean(v.priceNegotiable);
    } else {
      payload.monthlyRent = num(v.monthlyRent);
      payload.securityDeposit = num(v.securityDeposit);
      payload.rentNegotiable = Boolean(v.rentNegotiable);
      payload.preferredTenant = preferredTenant;
      payload.availableFrom = str(v.availableFrom);
      payload.minLeasePeriod = str(v.minLeasePeriod);
    }
    if (possessionStatus === "under-construction") {
      payload.reraNumber = str(v.reraNumber);
      if (reraStateId) payload.reraStateId = reraStateId;
    }
    // Drop undefined so a draft doesn't send noise.
    for (const k of Object.keys(payload)) {
      if (payload[k] === undefined) delete payload[k];
    }
    return payload;
  }

  async function persist(submit: boolean): Promise<{ id: string; status: string; slug: string | null } | null> {
    setError(null);
    setFieldErrors({});
    try {
      // Staff (no-draft) hosts publish in a single POST to their own endpoint,
      // with the dealer fixed server-side via extraPayload. No `submit` flag and
      // no PATCH-by-draft round trips.
      if (!config.supportsDraft) {
        const res = await apiFetch<{ _id: string; status: string; slug: string | null }>(
          config.createEndpoint,
          { method: "POST", body: JSON.stringify({ ...buildPayload(), ...config.extraPayload }) },
        );
        return { id: res._id, status: res.status, slug: res.slug };
      }
      const body = JSON.stringify({ ...buildPayload(), submit });
      const res = draftId
        ? await apiFetch<{ id: string; status: string; slug: string | null }>(
            `/api/listings/${draftId}`,
            { method: "PATCH", body },
          )
        : await apiFetch<{ id: string; status: string; slug: string | null }>(
            config.createEndpoint,
            { method: "POST", body },
          );
      setDraftId(res.id);
      return res;
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        const fe = (err.details as { fieldErrors?: Record<string, string> })?.fieldErrors;
        if (fe) setFieldErrors(fe);
      } else {
        setError("Something went wrong. Please try again.");
      }
      return null;
    }
  }

  async function next() {
    if (config.supportsDraft) {
      setBusy(true);
      await persist(false); // autosave draft on every step forward
      setBusy(false);
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }
  function prev() {
    setStep((s) => Math.max(0, s - 1));
  }
  async function saveDraft() {
    setBusy(true);
    const res = await persist(false);
    setBusy(false);
    if (res) router.push("/dealer/listings");
  }
  async function submitListing() {
    setShowErrors(true);
    // Don't round-trip a submission we already know is incomplete - take the
    // dealer straight to the first thing that needs fixing.
    if (issues.length > 0) {
      goToField(issues[0]!.step, issues[0]!.fieldId);
      return;
    }
    setBusy(true);
    const res = await persist(true);
    setBusy(false);
    if (res) router.push(config.doneHref);
  }

  const folder = useMemo(
    () => listingFolder(loc.cityId || "misc", effectiveLocalityId || "misc"),
    [loc.cityId, effectiveLocalityId],
  );

  return (
    <div>
      {/* Stepper */}
      <ol className="mb-6 flex flex-wrap gap-1 text-meta">
        {STEPS.map((label, i) => {
          const flagged = showErrors && stepsWithIssues.has(i);
          return (
            <li key={label}>
              <button
                type="button"
                onClick={() => setStep(i)}
                aria-invalid={flagged || undefined}
                className={
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-colors " +
                  (i === step
                    ? "bg-ink-900 text-primary-foreground"
                    : flagged
                      ? "bg-danger-50 text-danger-700 ring-1 ring-danger-500/40 hover:bg-danger-100"
                      : i < step
                        ? "bg-success-50 text-success-700"
                        : "bg-surface-muted text-muted-foreground hover:bg-sand-200")
                }
              >
                <span className="tabular">{i + 1}</span> {label}
                {flagged && (
                  <span
                    aria-hidden
                    className={
                      "size-1.5 rounded-full " +
                      (i === step ? "bg-danger-500" : "bg-danger-600")
                    }
                  />
                )}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="rounded-card border border-border bg-surface p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-ink-950">
          {step + 1}. {STEPS[step]}
        </h2>

        {/* ---- Step 1: Basic ---- */}
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Purpose" required>
                <Select value={purpose} onValueChange={(v) => setValue("purpose", v as "sale" | "rent")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sale">For Sale</SelectItem>
                    <SelectItem value="rent">For Rent</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Property type" required>
                <Select value={propertyType} onValueChange={(v) => setValue("propertyType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {isPlot && (
              <div className="flex flex-col gap-1">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={Boolean(watch("isCntLand"))}
                    onCheckedChange={(c) => setValue("isCntLand", Boolean(c))}
                  />
                  CNT land
                </label>
                <p className="text-meta text-muted-foreground">
                  Tick if this plot falls under the Chotanagpur Tenancy Act.
                </p>
              </div>
            )}
            <Field label="Title" required error={fieldErrors.title}>
              <Input id="field-title" {...register("title")} placeholder="e.g. Spacious 2 BHK flat in Kanke" maxLength={160} />
            </Field>
            <Field
              label="Description"
              required
              error={fieldErrors.description}
              hint="At least 100 characters. Describe the property honestly - rooms, condition, neighbourhood."
            >
              <Textarea id="field-description" {...register("description")} rows={6} placeholder="Describe the property…" />
            </Field>
          </div>
        )}

        {/* ---- Step 2: Location ---- */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div id="field-locality">
              <LocationPicker value={loc} onChange={setLoc} onCityCenter={setMapCenter} />
            </div>
            <p className="text-meta text-muted-foreground">
              Can&apos;t find your locality? Use “Request to add” in the locality box. New
              areas are reviewed by an admin — your listing stays “pending-location” until
              it&apos;s approved.
            </p>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Sub-locality"><Input {...register("subLocality")} /></Field>
              <Field label="Project / society"><Input {...register("projectName")} /></Field>
              <Field label="Landmark"><Input {...register("landmark")} /></Field>
            </div>
            <Field label="Full address (never shown publicly)" hint="For our records only - buyers never see this.">
              <Input {...register("fullAddress")} />
            </Field>

            <div id="field-mappin">
              <Label required>Pin the exact location on the map</Label>
              <p className="mb-2 text-meta text-muted-foreground">
                Drag the pin, or paste a Google Maps link.
              </p>
              <MapPicker
                value={coords}
                onChange={(lat, lng) => setCoords({ lat, lng })}
                center={mapCenter}
                onResolveAddress={(addr) => {
                  if (!getValues("fullAddress")) setValue("fullAddress", addr);
                }}
              />
              {coords && (
                <p className="mt-1 text-meta text-muted-foreground tabular">
                  {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </p>
              )}
              {fieldErrors.lat && <p className="mt-1 text-meta text-danger-700">Please drop a map pin.</p>}
            </div>
          </div>
        )}

        {/* ---- Step 3: Property details ---- */}
        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-3">
            {isPlot ? (
              <Field label="Plot area (sq.ft.)"><NumInput reg={register("plotArea", { valueAsNumber: true })} /></Field>
            ) : (
              <>
                <Field label="BHK">
                  <Select value={watch("bhk") ?? undefined} onValueChange={(v) => setValue("bhk", v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {BHKS.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Bathrooms"><NumInput reg={register("bathrooms", { valueAsNumber: true })} /></Field>
                <Field label="Balconies"><NumInput reg={register("balconies", { valueAsNumber: true })} /></Field>
                <Field label="Carpet area (sq.ft.)"><NumInput reg={register("carpetArea", { valueAsNumber: true })} /></Field>
                <Field label="Built-up area (sq.ft.)"><NumInput reg={register("builtUpArea", { valueAsNumber: true })} /></Field>
                <Field label="Super built-up area (sq.ft.)"><NumInput reg={register("superBuiltUpArea", { valueAsNumber: true })} /></Field>
                <Field label="Floor"><NumInput reg={register("floor", { valueAsNumber: true })} /></Field>
                <Field label="Total floors"><NumInput reg={register("totalFloors", { valueAsNumber: true })} /></Field>
              </>
            )}
            <Field label="Facing">
              <Select value={watch("facing") ?? undefined} onValueChange={(v) => setValue("facing", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{FACING.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Age of property">
              <Select value={watch("ageOfProperty") ?? undefined} onValueChange={(v) => setValue("ageOfProperty", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{AGE.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
        )}

        {/* ---- Step 4: Furnishing & amenities ---- */}
        {step === 3 && (
          <div className="flex flex-col gap-5">
            <Field label="Furnishing">
              <Select value={watch("furnishing") ?? undefined} onValueChange={(v) => setValue("furnishing", v)}>
                <SelectTrigger className="max-w-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="furnished">Furnished</SelectItem>
                  <SelectItem value="semi-furnished">Semi-furnished</SelectItem>
                  <SelectItem value="unfurnished">Unfurnished</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <CheckGroup label="Furnishing details" options={FURNISHING_DETAILS} value={furnishingDetails} onChange={setFurnishingDetails} />
            <CheckGroup label="Amenities" options={AMENITIES} value={amenities} onChange={setAmenities} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Parking"><Input {...register("parking")} placeholder="e.g. 1 covered" /></Field>
              <CheckGroup label="Water source" options={WATER_SOURCES} value={waterSource} onChange={setWaterSource} inline />
            </div>
          </div>
        )}

        {/* ---- Step 5: Price ---- */}
        {step === 4 && (
          <div className="flex flex-col gap-4">
            {purpose === "sale" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Expected price (₹)" required error={fieldErrors.expectedPrice}>
                  <PriceField id="field-expectedPrice" name="expectedPrice" control={control} />
                </Field>
                <Field label="Booking amount (₹)"><PriceField name="bookingAmount" control={control} /></Field>
                <CheckOne label="Price negotiable" checked={Boolean(watch("priceNegotiable"))} onChange={(c) => setValue("priceNegotiable", c)} />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Monthly rent (₹)" required error={fieldErrors.monthlyRent}>
                  <PriceField id="field-monthlyRent" name="monthlyRent" control={control} />
                </Field>
                <Field label="Security deposit (₹)"><PriceField name="securityDeposit" control={control} /></Field>
                <Field label="Available from"><Input type="date" {...register("availableFrom")} /></Field>
                <Field label="Minimum lease"><Input {...register("minLeasePeriod")} placeholder="e.g. 11 months" /></Field>
                <CheckGroup label="Preferred tenants" options={TENANTS} value={preferredTenant} onChange={setPreferredTenant} inline />
                <CheckOne label="Rent negotiable" checked={Boolean(watch("rentNegotiable"))} onChange={(c) => setValue("rentNegotiable", c)} />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Maintenance / month (₹)"><PriceField name="maintenanceCharge" control={control} /></Field>
              <Field label="Brokerage" hint="Shown publicly for transparency."><Input {...register("brokerage")} placeholder="e.g. No brokerage / 15 days rent" /></Field>
            </div>
          </div>
        )}

        {/* ---- Step 6: Possession & legal ---- */}
        {step === 5 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Possession status">
              <Select value={possessionStatus ?? undefined} onValueChange={(v) => setValue("possessionStatus", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ready-to-move">Ready to move</SelectItem>
                  <SelectItem value="under-construction">Under construction</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Possession date"><Input type="date" {...register("possessionDate")} /></Field>
            <Field label="Ownership type">
              <Select value={watch("ownershipType") ?? undefined} onValueChange={(v) => setValue("ownershipType", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="freehold">Freehold</SelectItem>
                  <SelectItem value="leasehold">Leasehold</SelectItem>
                  <SelectItem value="co-operative-society">Co-operative society</SelectItem>
                  <SelectItem value="power-of-attorney">Power of attorney</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {possessionStatus === "under-construction" && (
              <>
                <Field label="RERA number" required error={fieldErrors.reraNumber}>
                  <Input id="field-reraNumber" {...register("reraNumber")} placeholder="RERA registration number" />
                </Field>
                <Field label="RERA state" required error={fieldErrors.reraStateId}>
                  <div id="field-reraStateId">
                    <ReraStateSelect value={reraStateId} onChange={setReraStateId} states={reraStates} setStates={setReraStates} />
                  </div>
                </Field>
                <p className="text-meta text-warning-700 sm:col-span-2">
                  Under-construction listings require a valid RERA number and state.
                </p>
              </>
            )}
          </div>
        )}

        {/* ---- Step 7: Media ---- */}
        {step === 6 && (
          <div id="field-photos" className="flex flex-col gap-3">
            <Label required>Photos (at least 3)</Label>
            <ImageUploader
              folder={folder}
              value={photos}
              onChange={setPhotos}
              coverIndex={coverIndex}
              onCoverChange={setCoverIndex}
              maxCount={15}
            />
            {fieldErrors.photos && <p className="text-meta text-danger-700">{fieldErrors.photos}</p>}
          </div>
        )}

        {/* ---- Step 8: Review ---- */}
        {step === 7 && (
          <Review
            values={getValues()}
            loc={loc}
            coords={coords}
            photos={photos}
            amenities={amenities}
            issues={issues}
            note={config.reviewNote}
            readyNote={config.reviewReadyNote}
            onFix={(it) => goToField(it.step, it.fieldId)}
          />
        )}

        {error && <p className="mt-4 text-sm text-danger-700">{error}</p>}
      </div>

      {/* Footer nav: Back on the left, forward actions on the right. */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" onClick={prev} disabled={step === 0 || busy}>
          <ChevronLeft className="size-4" /> Back
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          {config.supportsDraft && (
            <Button variant="ghost" onClick={saveDraft} disabled={busy}>
              Save draft & exit
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={next} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {config.supportsDraft ? "Save & continue" : "Continue"} <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={submitListing} disabled={busy} size="lg">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {config.submitLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- small field helpers ----

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label required={required}>{label}</Label>
      {children}
      {hint && !error && <p className="text-meta text-muted-foreground">{hint}</p>}
      {error && <p className="text-meta text-danger-700">{error}</p>}
    </div>
  );
}

/** RHF-bound price field: live INR grouping + words, stores a raw Number. */
function PriceField({
  name,
  control,
  id,
}: {
  name: "expectedPrice" | "bookingAmount" | "monthlyRent" | "securityDeposit" | "maintenanceCharge";
  control: Control<FormValues>;
  id?: string;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <PriceInput
          id={id}
          value={
            field.value != null && !Number.isNaN(field.value as number)
              ? String(field.value)
              : ""
          }
          onChange={(raw) => field.onChange(raw === "" ? NaN : Number(raw))}
        />
      )}
    />
  );
}

function NumInput({ reg, id }: { reg: UseFormRegisterReturn; id?: string }) {
  return <Input id={id} type="number" inputMode="numeric" {...reg} />;
}

function CheckOne({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (c: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 self-end pb-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(c) => onChange(Boolean(c))} /> {label}
    </label>
  );
}

function CheckGroup({
  label,
  options,
  value,
  onChange,
  inline,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  inline?: boolean;
}) {
  const toggle = (opt: string, on: boolean) =>
    onChange(on ? [...value, opt] : value.filter((x) => x !== opt));
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className={inline ? "flex flex-wrap gap-3" : "grid grid-cols-2 gap-2 sm:grid-cols-3"}>
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm">
            <Checkbox checked={value.includes(opt)} onCheckedChange={(c) => toggle(opt, Boolean(c))} />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}

function ReraStateSelect({
  value,
  onChange,
  states,
  setStates,
}: {
  value: string;
  onChange: (v: string) => void;
  states: { _id: string; name: string }[];
  setStates: (s: { _id: string; name: string }[]) => void;
}) {
  useEffect(() => {
    if (states.length > 0) return;
    apiFetch<{ _id: string; name: string }[]>("/api/locations/states")
      .then((s) => setStates(s))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
      <SelectContent>
        {states.map((s) => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function Review({
  values,
  loc,
  coords,
  photos,
  amenities,
  issues,
  note,
  readyNote,
  onFix,
}: {
  values: FormValues;
  loc: LocationValue;
  coords: { lat: number; lng: number } | null;
  photos: UploadedImage[];
  amenities: string[];
  issues: Issue[];
  note: string;
  readyNote: string;
  onFix: (issue: Issue) => void;
}) {
  const price =
    values.purpose === "sale" ? values.expectedPrice : values.monthlyRent;
  const priceLabel = price ? formatListingPrice(values.purpose, price) : null;
  const rows: [string, string | undefined][] = [
    ["Purpose", values.purpose === "sale" ? "For sale" : "For rent"],
    ["Type", values.propertyType],
    ["Title", values.title],
    ["Locality", loc.localityId ? "Selected" : undefined],
    ["Map pin", coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : undefined],
    ["Price", priceLabel ? `${priceLabel.primary}${priceLabel.suffix ? " " + priceLabel.suffix : ""}` : undefined],
    ["Photos", `${photos.length}`],
    ["Amenities", amenities.length ? amenities.join(", ") : undefined],
  ];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{note}</p>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-border py-1.5 text-sm">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right font-medium text-ink-950">{v ?? "—"}</dd>
          </div>
        ))}
      </dl>

      {issues.length > 0 ? (
        <div className="rounded-card border border-danger-100 bg-danger-50 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-danger-700">
            <AlertCircle className="size-4 shrink-0" />
            Fix {issues.length} {issues.length === 1 ? "thing" : "things"} before submitting
          </p>
          <ul className="flex flex-col divide-y divide-danger-100">
            {issues.map((it) => (
              <li key={it.fieldId} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <span className="text-sm text-danger-700">{it.label}</span>
                <button
                  type="button"
                  onClick={() => onFix(it)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-control border border-danger-500 bg-surface px-2.5 py-1 text-meta font-medium text-danger-700 transition-colors hover:bg-danger-100"
                >
                  Fix <span className="text-muted-foreground">· Step {it.step + 1}</span>
                  <ArrowRight className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="inline-flex items-center gap-2 rounded-card border border-success-100 bg-success-50 px-4 py-3 text-sm font-medium text-success-700">
          <Check className="size-4" /> {readyNote}
        </p>
      )}
    </div>
  );
}
