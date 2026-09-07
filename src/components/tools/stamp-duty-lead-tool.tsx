"use client";

import { useMemo, useState } from "react";
import { Loader2, ArrowLeft, MessageCircle, Landmark, Sparkles } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { groupINR, inrWords } from "@/lib/utils/price";
import { allStampDutyStates, getStateStampDuty } from "@/data/stamp-duty-rates";
import { useToolLead } from "@/components/tools/use-tool-lead";

type BuyerType = "male" | "female" | "joint";

interface StampDutyOutput {
  stateName: string;
  buyerType: BuyerType;
  propertyValue: number;
  stampDutyPct: number;
  stampDuty: number;
  registrationPct: number;
  registration: number;
  totalAdditional: number;
  grandTotal: number;
  rebate: number;
  note: string | null;
  lastUpdated: string;
  source: string;
}

const BUYERS: { value: BuyerType; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "joint", label: "Joint (male + female)" },
];
const PROPERTY_TYPES = [
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "plot", label: "Plot / land" },
];
const AREA_TYPES = [
  { value: "urban", label: "Urban" },
  { value: "rural", label: "Rural" },
];

function money(n: number): string {
  return `₹${groupINR(n)}`;
}

/**
 * Stamp-duty calculator as a lead magnet. Inputs are collected on-page; the
 * detailed breakdown is revealed after a WhatsApp OTP (or instantly for a
 * logged-in buyer) and a lead is captured. The result is computed SERVER-SIDE.
 */
export function StampDutyLeadTool({ initialStateSlug }: { initialStateSlug?: string }) {
  const states = useMemo(() => allStampDutyStates(), []);
  const [stateSlug, setStateSlug] = useState(
    initialStateSlug && getStateStampDuty(initialStateSlug) ? initialStateSlug : states[0]?.slug ?? "",
  );
  const [value, setValue] = useState(5_000_000);
  const [buyerType, setBuyerType] = useState<BuyerType>("male");
  const [propertyType, setPropertyType] = useState("residential");
  const [areaType, setAreaType] = useState("urban");
  const [phone, setPhone] = useState("");
  const [digits, setDigits] = useState("");

  const lead = useToolLead<StampDutyOutput>("stamp_duty");
  const state = getStateStampDuty(stateSlug);
  const hasRate = Boolean(state?.stampDuty);

  function calculate() {
    lead.start({ stateSlug, propertyValue: value, buyerType, propertyType, areaType });
  }

  // ---- Result ----
  if (lead.phase === "done" && lead.result) {
    const r = lead.result;
    return <Result r={r} deduped={lead.deduped} onReset={() => window.location.reload()} />;
  }

  // ---- OTP gate ----
  if (lead.phase === "phone" || lead.phase === "code") {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 rounded-card border border-border bg-surface p-6 shadow-card">
        <button
          type="button"
          onClick={lead.backToForm}
          className="inline-flex items-center gap-1 self-start text-meta font-medium text-clay-700 hover:underline"
        >
          <ArrowLeft className="size-3.5" /> Back
        </button>
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-clay-600" />
          <h2 className="text-lg font-semibold text-ink-950">Get your full breakdown on WhatsApp</h2>
        </div>

        {lead.phase === "phone" ? (
          <>
            <p className="text-sm text-muted-foreground">
              Enter your WhatsApp number — we&apos;ll send a 6-digit code and unlock your detailed
              cost breakdown.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label required>WhatsApp number</Label>
              <div className="relative">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">+91</span>
                <Input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-12"
                />
              </div>
            </div>
            {lead.error && <p className="text-meta text-danger-700">{lead.error}</p>}
            <Button onClick={() => lead.sendCode(phone.trim())} disabled={lead.busy || !phone.trim()} block>
              {lead.busy ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
              Send code on WhatsApp
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to +91 {phone.trim()}.</p>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit code"
              value={digits}
              onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="text-center text-lg font-semibold tracking-[0.3em]"
            />
            {lead.error && <p className="text-meta text-danger-700">{lead.error}</p>}
            <Button onClick={() => lead.verifyCode(phone.trim(), digits)} disabled={lead.busy || digits.length !== 6} block>
              {lead.busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Verify &amp; see my breakdown
            </Button>
          </>
        )}
      </div>
    );
  }

  // ---- Form ----
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label>State</Label>
          <Select value={stateSlug} onValueChange={setStateSlug}>
            <SelectTrigger><SelectValue placeholder="Choose a state" /></SelectTrigger>
            <SelectContent>
              {states.map((s) => (
                <SelectItem key={s.slug} value={s.slug}>
                  {s.name}
                  {!s.stampDuty ? " — coming soon" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink-900">Property value</span>
            <span className="rounded-control bg-surface-muted px-2 py-0.5 text-sm font-semibold text-ink-950">
              {money(value)}
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
          <p className="text-meta text-muted-foreground">{inrWords(value)} Rupees</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Buyer</Label>
            <Select value={buyerType} onValueChange={(v) => setBuyerType(v as BuyerType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BUYERS.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Property type</Label>
            <Select value={propertyType} onValueChange={setPropertyType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Area</Label>
            <Select value={areaType} onValueChange={setAreaType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AREA_TYPES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {lead.error && <p className="text-meta text-danger-700">{lead.error}</p>}

        {hasRate ? (
          <Button onClick={calculate} disabled={lead.busy} size="lg">
            {lead.busy ? <Loader2 className="size-4 animate-spin" /> : <Landmark className="size-4" />}
            Calculate stamp duty
          </Button>
        ) : (
          <p className="rounded-control border border-warning-100 bg-warning-50 px-3 py-2 text-sm text-warning-700">
            Stamp duty data for {state?.name ?? "this state"} is coming soon. We only show verified
            rates, never a guessed number.
          </p>
        )}
      </div>

      {/* Right rail: what they'll get */}
      <div className="flex flex-col justify-center gap-3 rounded-card border border-dashed border-border bg-surface-muted/50 p-6">
        <Sparkles className="size-6 text-clay-600" />
        <h3 className="text-lg font-semibold text-ink-950">Your detailed breakdown</h3>
        <p className="text-sm text-muted-foreground">
          See stamp duty, registration charges, the total add-on cost and your grand total — plus
          any women/joint concession. Verify on WhatsApp to unlock it.
        </p>
        <ul className="mt-1 flex flex-col gap-1.5 text-sm text-ink-800">
          <li>• Stamp duty + registration, itemised</li>
          <li>• Female / joint rebate highlighted</li>
          <li>• Grand total incl. property value</li>
        </ul>
      </div>
    </div>
  );
}

function Result({ r, deduped, onReset }: { r: StampDutyOutput; deduped: boolean; onReset: () => void }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 rounded-card border border-border bg-surface p-6 shadow-card">
      <div className="flex items-center gap-2">
        <Landmark className="size-5 text-clay-600" />
        <h2 className="text-lg font-semibold text-ink-950">
          {r.stateName} — stamp duty on {money(r.propertyValue)}
        </h2>
      </div>

      <dl className="flex flex-col divide-y divide-border">
        <Row k={`Stamp duty (${r.stampDutyPct}%)`} v={money(r.stampDuty)} />
        <Row k={`Registration (${r.registrationPct}%)`} v={money(r.registration)} />
        <Row k="Total additional cost" v={money(r.totalAdditional)} strong />
        <Row k="Grand total (with property value)" v={money(r.grandTotal)} strong />
      </dl>

      {r.rebate > 0 && (
        <div className="rounded-control border border-success-100 bg-success-50 px-3 py-2 text-sm text-success-700">
          <b>You save {money(r.rebate)}</b> vs the general rate thanks to the{" "}
          {r.buyerType === "female" ? "women's" : "joint-ownership"} concession.
        </div>
      )}

      <p className="text-meta text-muted-foreground">{inrWords(r.grandTotal)} Rupees total.</p>

      {r.note && <p className="rounded-control bg-surface-muted px-3 py-2 text-meta text-muted-foreground">{r.note}</p>}

      <div className="rounded-control border border-warning-100 bg-warning-50 px-3 py-2 text-meta text-warning-700">
        This is an estimate. Confirm the exact charges at your sub-registrar office.
        {" "}Rates last updated {r.lastUpdated}
        {r.source ? (
          <>
            {" · "}
            <a href={r.source} target="_blank" rel="noopener noreferrer" className="underline">
              official portal
            </a>
          </>
        ) : null}
      </div>

      {deduped && (
        <p className="text-meta text-muted-foreground">
          You already requested this recently — showing your saved estimate.
        </p>
      )}

      <Button variant="outline" onClick={onReset}>Calculate again</Button>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className={strong ? "text-sm font-medium text-ink-900" : "text-sm text-muted-foreground"}>{k}</dt>
      <dd className={strong ? "text-base font-semibold text-ink-950" : "text-sm font-medium text-ink-900"}>{v}</dd>
    </div>
  );
}
