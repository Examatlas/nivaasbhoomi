"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Loader2,
  ArrowLeft,
  MessageCircle,
  ShieldAlert,
  Printer,
  AlertTriangle,
  ExternalLink,
  Sparkles,
  Ban,
  MapPin,
} from "lucide-react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToolLead } from "@/components/tools/use-tool-lead";
import {
  allCntSptDistricts,
  getCntSptDistrict,
  BUYER_TYPE_LABELS,
  LAND_TYPE_LABELS,
  type CntSptOutput,
  type CntBuyerType,
  type CntLandType,
} from "@/data/cnt-spt-districts";

const BUYERS = Object.entries(BUYER_TYPE_LABELS) as [CntBuyerType, string][];
const LANDS = Object.entries(LAND_TYPE_LABELS) as [CntLandType, string][];

/** Jharkhand CNT/SPT land checker lead magnet. Inputs on-page; the detailed
 *  answer + "Save as PDF" unlock after a WhatsApp OTP (or instantly when logged
 *  in). The verdict is computed SERVER-SIDE from verified data. */
export function CntSptTool({ initialDistrictSlug }: { initialDistrictSlug?: string }) {
  const districts = allCntSptDistricts();
  const [districtSlug, setDistrictSlug] = useState(
    initialDistrictSlug && getCntSptDistrict(initialDistrictSlug)
      ? initialDistrictSlug
      : districts[0]?.slug ?? "",
  );
  const [buyerType, setBuyerType] = useState<CntBuyerType>("non_tribal");
  const [landType, setLandType] = useState<CntLandType>("residential");
  const [phone, setPhone] = useState("");
  const [digits, setDigits] = useState("");

  const lead = useToolLead<CntSptOutput>("cnt_spt_check");

  if (lead.phase === "done" && lead.result) {
    return <CntSptResult r={lead.result} onReset={() => window.location.reload()} />;
  }

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
          <h2 className="text-lg font-semibold text-ink-950">Get the full answer on WhatsApp</h2>
        </div>
        {lead.phase === "phone" ? (
          <>
            <p className="text-sm text-muted-foreground">
              Enter your WhatsApp number — we&apos;ll send a 6-digit code and unlock the printable
              report.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label required>WhatsApp number</Label>
              <div className="relative">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                  +91
                </span>
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
              Verify &amp; see the answer
            </Button>
          </>
        )}
      </div>
    );
  }

  // ---- form ----
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label>District</Label>
          <Select value={districtSlug} onValueChange={setDistrictSlug}>
            <SelectTrigger><SelectValue placeholder="Choose a district" /></SelectTrigger>
            <SelectContent>
              {districts.map((d) => (
                <SelectItem key={d.slug} value={d.slug}>
                  {d.name} — {d.act}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Who is buying?</Label>
          <Select value={buyerType} onValueChange={(v) => setBuyerType(v as CntBuyerType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {BUYERS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Land type</Label>
          <Select value={landType} onValueChange={(v) => setLandType(v as CntLandType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANDS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {lead.error && <p className="text-meta text-danger-700">{lead.error}</p>}

        <Button onClick={() => lead.start({ districtSlug, buyerType, landType })} disabled={lead.busy} size="lg">
          {lead.busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldAlert className="size-4" />}
          Check if I can buy
        </Button>
      </div>

      <div className="flex flex-col justify-center gap-3 rounded-card border border-dashed border-border bg-surface-muted/50 p-6">
        <Sparkles className="size-6 text-clay-600" />
        <h3 className="text-lg font-semibold text-ink-950">A clear yes / no on CNT &amp; SPT land</h3>
        <p className="text-sm text-muted-foreground">
          Jharkhand&apos;s biggest land confusion, answered plainly — whether this district is under
          the CNT or SPT Act, whether your buyer type can buy, what permission is needed, and the
          home-loan catch most people miss.
        </p>
        <ul className="mt-1 flex flex-col gap-1.5 text-sm text-ink-800">
          <li>• Which Act applies + allowed / restricted / not allowed</li>
          <li>• DC permission, documents and the home-loan warning</li>
          <li>• Official sources + a printable report</li>
        </ul>
      </div>
    </div>
  );
}

function VerdictBadge({ verdict, label }: { verdict: CntSptOutput["verdict"]; label: string }) {
  const notAllowed = verdict === "not_allowed";
  return (
    <span
      className={
        notAllowed
          ? "inline-flex items-center gap-1.5 rounded-full bg-danger-50 px-3 py-1 text-sm font-semibold text-danger-700"
          : "inline-flex items-center gap-1.5 rounded-full bg-warning-50 px-3 py-1 text-sm font-semibold text-warning-700"
      }
    >
      {notAllowed ? <Ban className="size-4" /> : <AlertTriangle className="size-4" />}
      {label}
    </span>
  );
}

function CntSptResult({ r, onReset }: { r: CntSptOutput; onReset: () => void }) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 no-print">
        <h2 className="text-lg font-semibold text-ink-950">
          {r.districtName} · {r.buyerLabel} · {r.landLabel}
        </h2>
        <div className="flex gap-2">
          <Button type="button" onClick={() => window.print()}>
            <Printer className="size-4" /> Print / Save as PDF
          </Button>
          <Button type="button" variant="outline" onClick={onReset}>Start over</Button>
        </div>
      </div>

      <div className="nb-print-area rounded-card border border-border bg-surface p-6">
        <div className="print-only mb-4 border-b border-ink-200 pb-3">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-ink-950">NivaasBhoomi</span>
            <span className="text-sm text-ink-700">CNT / SPT land check</span>
          </div>
          <p className="mt-1 text-sm text-ink-700">
            {r.districtName} · {r.buyerLabel} · {r.landLabel}
          </p>
        </div>

        {/* Verdict */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <VerdictBadge verdict={r.verdict} label={r.verdictLabel} />
            <span className="text-meta text-muted-foreground">
              {r.districtName} · {r.division} division · {r.act} Act
            </span>
          </div>
          <p className="text-base font-medium text-ink-900">{r.summary}</p>
        </div>

        {/* Kolhan Government Estate special rule (CNT Sec 46(3)) — prominent box */}
        {r.kolhanRule && (
          <div className="print-section mt-4 rounded-control border border-clay-300 bg-clay-50 px-4 py-3">
            <h3 className="flex items-center gap-1.5 text-base font-semibold text-clay-800">
              <ShieldAlert className="size-4 shrink-0" /> {r.kolhanRule.heading}
            </h3>
            <p className="mt-1.5 text-sm text-clay-900">{r.kolhanRule.text}</p>
            <blockquote className="mt-2 border-l-2 border-clay-300 pl-3 text-meta text-clay-800 italic">
              “{r.kolhanRule.quote}”
              <span className="mt-0.5 block text-overline text-clay-700 not-italic">
                — {r.kolhanRule.section}
              </span>
            </blockquote>
          </div>
        )}

        {/* Caveat — prominent */}
        <p className="mt-4 rounded-control border border-warning-100 bg-warning-50 px-3 py-2 text-meta text-warning-800">
          {r.caveat}
        </p>

        <div className="mt-6 flex flex-col gap-5">
          <Field title={`Which law applies`} body={r.actName} />
          <Field title="Permission needed" body={r.permission} />

          <section className="print-section">
            <h3 className="text-base font-semibold text-ink-950">Documents usually needed</h3>
            <ul className="mt-2 flex flex-col gap-2">
              {r.documents.map((d, i) => (
                <li key={i} className="flex gap-2.5 text-sm">
                  <span className="mt-0.5 inline-block size-4 shrink-0 rounded-[3px] border border-ink-400" aria-hidden />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </section>

          <Field title="How long it takes" body={r.timeline} />
          <Field title="Can the land use be changed?" body={r.conversion} />

          <section className="print-section rounded-control border border-danger-100 bg-danger-50 px-3 py-2.5">
            <h3 className="flex items-center gap-1.5 text-base font-semibold text-danger-700">
              <AlertTriangle className="size-4" /> Home-loan warning
            </h3>
            <p className="mt-1 text-sm text-danger-800">{r.homeLoanWarning}</p>
          </section>

          <section className="print-section">
            <h3 className="text-base font-semibold text-ink-950">Official sources</h3>
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {r.sources.map((u) => (
                <li key={u}>
                  <a href={u} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-clay-700 hover:underline">
                    {u} <ExternalLink className="size-3.5 shrink-0 no-print" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="mt-6 rounded-control border border-warning-100 bg-warning-50 px-3 py-2 text-meta text-warning-700 print-section">
          <b>Disclaimer:</b> {r.disclaimer} Last reviewed {r.lastUpdated}.
        </div>

        <div className="print-only mt-4 border-t border-ink-200 pt-2 text-center text-xs text-ink-600">
          {r.disclaimer} · nivaasbhoomi.com
        </div>
      </div>

      {/* Cross-links (screen only) */}
      <div className="mt-6 flex flex-wrap gap-3 no-print">
        <Link
          href={`/search?q=${encodeURIComponent(r.districtName)}`}
          className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-4 py-2 text-sm font-medium text-ink-800 hover:bg-surface-muted"
        >
          <MapPin className="size-4 text-clay-600" /> See plots in {r.districtName}
        </Link>
        <Link
          href="/tools/mutation-guide/jharkhand"
          className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-4 py-2 text-sm font-medium text-ink-800 hover:bg-surface-muted"
        >
          Mutation (dakhil-kharij) guide
        </Link>
        <Link
          href="/tools/property-checklist/jharkhand"
          className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-4 py-2 text-sm font-medium text-ink-800 hover:bg-surface-muted"
        >
          Jharkhand legal checklist
        </Link>
      </div>
    </div>
  );
}

function Field({ title, body }: { title: string; body: string }) {
  return (
    <section className="print-section">
      <h3 className="text-base font-semibold text-ink-950">{title}</h3>
      <p className="mt-1 text-sm text-ink-800">{body}</p>
    </section>
  );
}
