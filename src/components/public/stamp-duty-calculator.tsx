"use client";

import { useMemo, useState } from "react";

import {
  computeStampDuty,
  type BuyerCategory,
} from "@/lib/calculators/stamp-duty";
import type { StampDutyState } from "@/lib/calculators/states";
import { formatPrice } from "@/lib/utils/price";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const CATEGORIES: { value: BuyerCategory; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "joint", label: "Joint (male + female)" },
];

/**
 * State-wise stamp duty calculator (Phase 8). Rate depends on the STATE and the
 * BUYER category (many states give women a concession). Pure math from
 * lib/calculators/stamp-duty; rates come pre-resolved from the server.
 */
export function StampDutyCalculator({ states }: { states: StampDutyState[] }) {
  const [value, setValue] = useState(5000000);
  const [stateCode, setStateCode] = useState(states[0]?.code ?? "");
  const [category, setCategory] = useState<BuyerCategory>("male");

  const state = states.find((s) => s.code === stateCode) ?? states[0];
  const ratePct = state ? state.rate[category] : 6;

  const result = useMemo(
    () => computeStampDuty({ propertyValue: value, ratePct }),
    [value, ratePct],
  );

  const savingVsMale =
    state && category === "female" ? state.rate.male - state.rate.female : 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink-900">Property value</span>
            <span className="tabular rounded-control bg-surface-muted px-2 py-0.5 text-sm font-semibold text-ink-950">
              {formatPrice(value)}
            </span>
          </div>
          <input
            type="range"
            min={500000}
            max={100000000}
            step={100000}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-sand-200 accent-clay-600"
            aria-label="Property value"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>State</Label>
          <Select value={stateCode} onValueChange={setStateCode}>
            <SelectTrigger>
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {states.map((s) => (
                <SelectItem key={s.code} value={s.code}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Buyer</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as BuyerCategory)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {savingVsMale > 0 && (
            <p className="text-meta text-success-700">
              Women pay {savingVsMale}% less stamp duty in {state?.name} — a saving of{" "}
              {formatPrice(Math.round((value * savingVsMale) / 100))}.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6">
        <div className="text-center">
          <p className="text-meta text-muted-foreground">
            Stamp duty ({result.ratePct}% in {state?.name})
          </p>
          <p className="mt-1 text-display-sm text-ink-950 tabular">
            {formatPrice(result.stampDuty)}
          </p>
        </div>
        <dl className="flex flex-col gap-2 text-sm">
          <Row k="Property value" v={formatPrice(result.propertyValue)} />
          <Row k={`Stamp duty (${result.ratePct}%)`} v={formatPrice(result.stampDuty)} />
          <Row k={`Registration (~${result.registrationPct}%)`} v={formatPrice(result.registration)} />
          <Row k="Total charges" v={formatPrice(result.total)} strong />
        </dl>
        <p className="text-overline text-subtle-foreground">
          Indicative headline rates. Actual duty can vary by area (urban/rural), property
          type and current state notifications — confirm with the sub-registrar.
        </p>
      </div>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between border-b border-border py-1.5 last:border-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={"tabular " + (strong ? "font-semibold text-ink-950" : "text-ink-800")}>{v}</dd>
    </div>
  );
}
