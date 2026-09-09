"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Loader2,
  ArrowLeft,
  MessageCircle,
  ScrollText,
  Printer,
  AlertTriangle,
  ExternalLink,
  Sparkles,
  Info,
  MapPin,
} from "lucide-react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToolLead } from "@/components/tools/use-tool-lead";
import {
  allMutationStates,
  getMutationState,
  MUTATION_PROPERTY_LABELS,
  MUTATION_TRANSFER_LABELS,
  type MutationOutput,
  type MutationPropertyType,
  type MutationTransferType,
} from "@/data/mutation-guide";

const PROPS = Object.entries(MUTATION_PROPERTY_LABELS) as [MutationPropertyType, string][];
const TRANSFERS = Object.entries(MUTATION_TRANSFER_LABELS) as [MutationTransferType, string][];

/** Mutation / dakhil-kharij guide lead magnet. Verified step-by-step for
 *  Bihar/Jharkhand/UP; "coming soon" for other states. Report unlocks after a
 *  WhatsApp OTP (or instantly when logged in); computed SERVER-SIDE. */
export function MutationGuideTool({ initialStateSlug }: { initialStateSlug?: string }) {
  const states = allMutationStates();
  const [stateSlug, setStateSlug] = useState(
    initialStateSlug && getMutationState(initialStateSlug) ? initialStateSlug : states[0]?.slug ?? "",
  );
  const [propertyType, setPropertyType] = useState<MutationPropertyType>("residential");
  const [transferType, setTransferType] = useState<MutationTransferType>("sale");
  const [phone, setPhone] = useState("");
  const [digits, setDigits] = useState("");

  const lead = useToolLead<MutationOutput>("mutation_guide");

  if (lead.phase === "done" && lead.result) {
    return <MutationResult r={lead.result} onReset={() => window.location.reload()} />;
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
          <h2 className="text-lg font-semibold text-ink-950">Get the guide on WhatsApp</h2>
        </div>
        {lead.phase === "phone" ? (
          <>
            <p className="text-sm text-muted-foreground">
              Enter your WhatsApp number — we&apos;ll send a 6-digit code and unlock the printable
              step-by-step guide.
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
              Verify &amp; see the guide
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
          <Label>State</Label>
          <Select value={stateSlug} onValueChange={setStateSlug}>
            <SelectTrigger><SelectValue placeholder="Choose a state" /></SelectTrigger>
            <SelectContent>
              {states.map((s) => (
                <SelectItem key={s.slug} value={s.slug}>
                  {s.name}
                  {s.verified ? " — full guide" : " — coming soon"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Property type</Label>
          <Select value={propertyType} onValueChange={(v) => setPropertyType(v as MutationPropertyType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROPS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>How did you get the property?</Label>
          <Select value={transferType} onValueChange={(v) => setTransferType(v as MutationTransferType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TRANSFERS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {lead.error && <p className="text-meta text-danger-700">{lead.error}</p>}

        <Button onClick={() => lead.start({ stateSlug, propertyType, transferType })} disabled={lead.busy} size="lg">
          {lead.busy ? <Loader2 className="size-4 animate-spin" /> : <ScrollText className="size-4" />}
          Get my mutation guide
        </Button>
      </div>

      <div className="flex flex-col justify-center gap-3 rounded-card border border-dashed border-border bg-surface-muted/50 p-6">
        <Sparkles className="size-6 text-clay-600" />
        <h3 className="text-lg font-semibold text-ink-950">Get your name on the land record</h3>
        <p className="text-sm text-muted-foreground">
          Mutation (dakhil-kharij) is how the government record is changed to your name after a
          sale, inheritance, gift or partition. Get the real step-by-step, the official portal, the
          documents and the appeal route if it gets stuck.
        </p>
        <ul className="mt-1 flex flex-col gap-1.5 text-sm text-ink-800">
          <li>• Numbered steps + official portal link</li>
          <li>• Documents, fees and timeline</li>
          <li>• What to do if it&apos;s rejected + common mistakes</li>
        </ul>
      </div>
    </div>
  );
}

function MutationResult({ r, onReset }: { r: MutationOutput; onReset: () => void }) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 no-print">
        <h2 className="text-lg font-semibold text-ink-950">
          {r.stateName} · {r.propertyLabel} · {r.transferLabel}
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
            <span className="text-sm text-ink-700">Mutation / dakhil-kharij guide</span>
          </div>
          <p className="mt-1 text-sm text-ink-700">
            {r.stateName} · {r.propertyLabel} · {r.transferLabel}
          </p>
        </div>

        {!r.verified ? (
          <p className="rounded-control border border-clay-100 bg-clay-50 px-3 py-2.5 text-sm text-clay-800">
            <Info className="mr-1.5 inline size-4" />
            {r.note}
          </p>
        ) : (
          <>
            {/* Portal */}
            {r.portal && (
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-semibold text-ink-950">
                  {r.online ? "Apply online" : "Where to apply"}
                </h3>
                <a
                  href={r.portal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 break-all text-clay-700 hover:underline"
                >
                  {r.portal.name} <ExternalLink className="size-3.5 shrink-0 no-print" />
                </a>
                <span className="print-only text-meta text-ink-600">{r.portal.url}</span>
                {r.records && r.records.url !== r.portal.url && (
                  <a
                    href={r.records.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 break-all text-clay-700 hover:underline"
                  >
                    {r.records.name} <ExternalLink className="size-3.5 shrink-0 no-print" />
                  </a>
                )}
              </div>
            )}

            {/* Steps (numbered — this is a real sequence) */}
            <section className="print-section mt-5">
              <h3 className="text-base font-semibold text-ink-950">Step by step</h3>
              <ol className="mt-2 flex flex-col gap-2.5">
                {r.steps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-clay-100 text-overline font-bold text-clay-800">
                      {i + 1}
                    </span>
                    <span className="text-ink-800">{s}</span>
                  </li>
                ))}
              </ol>
            </section>

            {r.note && (
              <p className="mt-4 rounded-control border border-clay-100 bg-clay-50 px-3 py-2 text-meta text-clay-800 print-section">
                <Info className="mr-1.5 inline size-3.5" />
                {r.note}
              </p>
            )}

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <MField title="Fees" body={r.fees} />
              <MField title="Timeline" body={r.timeline} />
              <MField title="Track status" body={r.statusTracking} />
              <MField title="If it's rejected" body={r.appeal} />
            </div>
          </>
        )}

        {/* Documents (always shown) */}
        <section className="print-section mt-5">
          <h3 className="text-base font-semibold text-ink-950">Documents you&apos;ll need</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {r.documents.map((d, i) => (
              <li key={i} className="flex gap-2.5 text-sm">
                <span className="mt-0.5 inline-block size-4 shrink-0 rounded-[3px] border border-ink-400" aria-hidden />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </section>

        {r.commonMistakes.length > 0 && (
          <section className="print-section mt-5">
            <h3 className="flex items-center gap-1.5 text-base font-semibold text-danger-700">
              <AlertTriangle className="size-4" /> Common mistakes that get applications rejected
            </h3>
            <ul className="mt-2 flex flex-col gap-1.5 text-sm text-ink-800">
              {r.commonMistakes.map((m, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden>•</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {r.sources.length > 0 && (
          <section className="print-section mt-5">
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
        )}

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
          href={`/search?q=${encodeURIComponent(r.stateName)}`}
          className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-4 py-2 text-sm font-medium text-ink-800 hover:bg-surface-muted"
        >
          <MapPin className="size-4 text-clay-600" /> Buying in {r.stateName}? See verified listings
        </Link>
        {r.stateSlug === "jharkhand" && (
          <Link
            href="/tools/cnt-spt-check"
            className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-4 py-2 text-sm font-medium text-ink-800 hover:bg-surface-muted"
          >
            Check CNT / SPT land rules
          </Link>
        )}
        <Link
          href={`/tools/property-checklist/${r.stateSlug}`}
          className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-4 py-2 text-sm font-medium text-ink-800 hover:bg-surface-muted"
        >
          {r.stateName} legal checklist
        </Link>
      </div>
    </div>
  );
}

function MField({ title, body }: { title: string; body: string }) {
  if (!body) return null;
  return (
    <section className="print-section">
      <h3 className="text-base font-semibold text-ink-950">{title}</h3>
      <p className="mt-1 text-sm text-ink-800">{body}</p>
    </section>
  );
}
