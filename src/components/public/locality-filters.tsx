"use client";

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
 * URL-driven filter bar on the locality page. Each selection maps to a
 * dedicated filter-page URL (its own indexable page, per Section 9/10) rather
 * than filtering client-side - that is what generates the SEO long-tail.
 *
 * `active` reflects the current filter (on a filter page) so the controls show
 * the applied state.
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
  { value: "2500000", label: "Under ₹25 L", seg: "under-25-lakh" },
  { value: "5000000", label: "Under ₹50 L", seg: "under-50-lakh" },
  { value: "7500000", label: "Under ₹75 L", seg: "under-75-lakh" },
  { value: "10000000", label: "Under ₹1 Cr", seg: "under-1-crore" },
  { value: "20000000", label: "Under ₹2 Cr", seg: "under-2-crore" },
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

export function LocalityFilters({
  citySlug,
  localitySlug,
  active,
}: {
  citySlug: string;
  localitySlug: string;
  active?: FilterQuery;
}) {
  const router = useRouter();
  const base = `/${citySlug}/${localitySlug}`;

  const go = (next: {
    propertyType?: string;
    bhk?: string;
    purpose?: string;
    furnishing?: string;
    budgetSeg?: string;
  }) => {
    const state = {
      propertyType: active?.propertyType ?? "",
      bhk: active?.bhk ?? "",
      purpose: (active?.purpose ?? "") as string,
      furnishing: (active?.furnishing ?? "") as string,
      ...next,
    };

    // No type -> can't build a filter URL; go to the locality page.
    if (!state.propertyType) {
      router.push(base);
      return;
    }
    // Budget is exclusive (Section 9 has only type+budget).
    if ("budgetSeg" in next && next.budgetSeg) {
      router.push(`${base}/${TYPE_TO_PLURAL[state.propertyType]}-${next.budgetSeg}`);
      return;
    }

    const fq: FilterQuery = { propertyType: state.propertyType };
    if (state.bhk) fq.bhk = state.bhk;
    else if (state.furnishing && state.purpose)
      fq.furnishing = state.furnishing as FilterQuery["furnishing"];
    if (state.purpose) fq.purpose = state.purpose as "sale" | "rent";

    const segment = filterToSegment(fq);
    router.push(segment ? `${base}/${segment}` : base);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface p-3">
      <FilterSelect
        placeholder="Type"
        value={active?.propertyType}
        options={TYPES}
        onChange={(v) => go({ propertyType: v === ANY ? "" : v })}
      />
      <FilterSelect
        placeholder="Purpose"
        value={active?.purpose}
        options={[
          { value: "sale", label: "Sale" },
          { value: "rent", label: "Rent" },
        ]}
        onChange={(v) => go({ purpose: v === ANY ? "" : (v as "sale" | "rent") })}
      />
      <FilterSelect
        placeholder="BHK"
        value={active?.bhk}
        options={BHKS}
        onChange={(v) => go({ bhk: v === ANY ? "" : v })}
      />
      <FilterSelect
        placeholder="Furnishing"
        value={active?.furnishing}
        options={[
          { value: "furnished", label: "Furnished" },
          { value: "semi-furnished", label: "Semi-furnished" },
          { value: "unfurnished", label: "Unfurnished" },
        ]}
        onChange={(v) => go({ furnishing: v === ANY ? "" : v })}
      />
      <FilterSelect
        placeholder="Budget"
        options={BUDGETS}
        onChange={(v) => {
          const b = BUDGETS.find((x) => x.value === v);
          go({ budgetSeg: b?.seg });
        }}
      />
      {active && (
        <Button variant="ghost" size="sm" onClick={() => router.push(base)}>
          Clear
        </Button>
      )}
    </div>
  );
}

function FilterSelect({
  placeholder,
  value,
  options,
  onChange,
}: {
  placeholder: string;
  value?: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto min-w-[7.5rem] text-sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>Any {placeholder.toLowerCase()}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
