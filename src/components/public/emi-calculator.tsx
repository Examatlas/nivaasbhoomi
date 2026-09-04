"use client";

import { useMemo, useState } from "react";

import { computeEmi } from "@/lib/calculators/emi";
import { formatPrice } from "@/lib/utils/price";

/**
 * Interactive EMI calculator (Phase 8). Pure math from lib/calculators/emi;
 * this is just the controls + a principal-vs-interest breakdown bar.
 */
export function EmiCalculator() {
  const [principal, setPrincipal] = useState(5000000);
  const [ratePct, setRatePct] = useState(8.5);
  const [years, setYears] = useState(20);

  const result = useMemo(
    () => computeEmi({ principal, annualRatePct: ratePct, tenureMonths: years * 12 }),
    [principal, ratePct, years],
  );

  const interestShare = result.totalPayment
    ? Math.round((result.totalInterest / result.totalPayment) * 100)
    : 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <div className="flex flex-col gap-6">
        <SliderField
          label="Loan amount"
          value={principal}
          display={formatPrice(principal)}
          min={100000}
          max={50000000}
          step={100000}
          onChange={setPrincipal}
        />
        <SliderField
          label="Interest rate (p.a.)"
          value={ratePct}
          display={`${ratePct.toFixed(2)}%`}
          min={5}
          max={20}
          step={0.05}
          onChange={setRatePct}
        />
        <SliderField
          label="Tenure"
          value={years}
          display={`${years} year${years === 1 ? "" : "s"}`}
          min={1}
          max={30}
          step={1}
          onChange={setYears}
        />
      </div>

      <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6">
        <div className="text-center">
          <p className="text-meta text-muted-foreground">Monthly EMI</p>
          <p className="mt-1 text-display-sm text-ink-950 tabular">{formatPrice(result.emi)}</p>
        </div>

        {/* Principal vs interest bar */}
        <div className="mt-2">
          <div className="flex h-3 overflow-hidden rounded-full">
            <div className="bg-ink-800" style={{ width: `${100 - interestShare}%` }} />
            <div className="bg-clay-400" style={{ width: `${interestShare}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-meta text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-sm bg-ink-800" /> Principal
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-sm bg-clay-400" /> Interest ({interestShare}%)
            </span>
          </div>
        </div>

        <dl className="mt-2 flex flex-col gap-2 text-sm">
          <Row k="Principal" v={formatPrice(result.principal)} />
          <Row k="Total interest" v={formatPrice(result.totalInterest)} />
          <Row k="Total payable" v={formatPrice(result.totalPayment)} strong />
        </dl>
        <p className="text-overline text-subtle-foreground">
          Indicative only. Actual EMI depends on your lender, processing fees and exact rate.
        </p>
      </div>
    </div>
  );
}

function SliderField({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink-900">{label}</span>
        <span className="tabular rounded-control bg-surface-muted px-2 py-0.5 text-sm font-semibold text-ink-950">
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-sand-200 accent-clay-600"
        aria-label={label}
      />
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
