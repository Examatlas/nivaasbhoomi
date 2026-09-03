"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { filterToSegment } from "@/lib/filters/segment";
import type { FilterQuery } from "@/lib/filters/parse";

/**
 * City-page filter bar. Filter pages are locality-scoped
 * (/[city]/[locality]/[filter]), so a city-level filter first needs a locality;
 * once a locality + type are chosen it routes to the matching indexable filter
 * URL (Section 9/10). No locality -> nothing to route to; type only -> we still
 * need the locality, so the Apply button stays disabled until one is picked.
 */
const TYPES = [
  { value: "flat", label: "Flats" },
  { value: "independent-house", label: "Independent Houses" },
  { value: "villa", label: "Villas" },
  { value: "plot", label: "Plots" },
  { value: "commercial-shop", label: "Shops" },
  { value: "office", label: "Offices" },
  { value: "pg", label: "PG" },
  { value: "warehouse", label: "Warehouses" },
];
const BHKS = [
  { value: "1rk", label: "1 RK" },
  { value: "1", label: "1 BHK" },
  { value: "2", label: "2 BHK" },
  { value: "3", label: "3 BHK" },
  { value: "4", label: "4 BHK" },
  { value: "5plus", label: "5+ BHK" },
];
const BUDGETS = [
  { value: "under-25-lakh", label: "Under ₹25 L" },
  { value: "under-50-lakh", label: "Under ₹50 L" },
  { value: "under-75-lakh", label: "Under ₹75 L" },
  { value: "under-1-crore", label: "Under ₹1 Cr" },
  { value: "under-2-crore", label: "Under ₹2 Cr" },
];
const ANY = "any";

const TYPE_TO_PLURAL: Record<string, string> = {
  flat: "flats",
  "independent-house": "independent-houses",
  villa: "villas",
  plot: "plots",
  "commercial-shop": "commercial-shops",
  office: "offices",
  pg: "pgs",
  warehouse: "warehouses",
};

export function CityFilters({
  citySlug,
  localities,
}: {
  citySlug: string;
  localities: { name: string; slug: string }[];
}) {
  const router = useRouter();
  const [locality, setLocality] = useState<string>("");
  const [propertyType, setPropertyType] = useState<string>("");
  const [purpose, setPurpose] = useState<string>("");
  const [bhk, setBhk] = useState<string>("");
  const [furnishing, setFurnishing] = useState<string>("");
  const [budget, setBudget] = useState<string>("");

  const clean = (v: string) => (v === ANY ? "" : v);

  const apply = () => {
    if (!locality) return;
    const base = `/${citySlug}/${locality}`;
    if (!propertyType) {
      router.push(base);
      return;
    }
    // Budget is exclusive (Section 9: only type + budget).
    if (budget) {
      router.push(`${base}/${TYPE_TO_PLURAL[propertyType]}-${budget}`);
      return;
    }
    const fq: FilterQuery = { propertyType };
    if (bhk) fq.bhk = bhk;
    else if (furnishing && purpose) fq.furnishing = furnishing as FilterQuery["furnishing"];
    if (purpose) fq.purpose = purpose as "sale" | "rent";
    const segment = filterToSegment(fq);
    router.push(segment ? `${base}/${segment}` : base);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface p-3">
      <Pick
        placeholder="Locality"
        value={locality || undefined}
        options={localities.map((l) => ({ value: l.slug, label: l.name }))}
        onChange={(v) => setLocality(clean(v))}
        includeAny={false}
      />
      <Pick
        placeholder="Type"
        value={propertyType || undefined}
        options={TYPES}
        onChange={(v) => setPropertyType(clean(v))}
      />
      <Pick
        placeholder="Purpose"
        value={purpose || undefined}
        options={[
          { value: "sale", label: "Sale" },
          { value: "rent", label: "Rent" },
        ]}
        onChange={(v) => setPurpose(clean(v))}
      />
      <Pick
        placeholder="BHK"
        value={bhk || undefined}
        options={BHKS}
        onChange={(v) => setBhk(clean(v))}
      />
      <Pick
        placeholder="Furnishing"
        value={furnishing || undefined}
        options={[
          { value: "furnished", label: "Furnished" },
          { value: "semi-furnished", label: "Semi-furnished" },
          { value: "unfurnished", label: "Unfurnished" },
        ]}
        onChange={(v) => setFurnishing(clean(v))}
      />
      <Pick
        placeholder="Budget"
        value={budget || undefined}
        options={BUDGETS}
        onChange={(v) => setBudget(clean(v))}
      />
      <Button size="sm" onClick={apply} disabled={!locality}>
        Apply
      </Button>
    </div>
  );
}

function Pick({
  placeholder,
  value,
  options,
  onChange,
  includeAny = true,
}: {
  placeholder: string;
  value?: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  includeAny?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto min-w-[7.5rem] text-sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {includeAny && <SelectItem value={ANY}>Any {placeholder.toLowerCase()}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
