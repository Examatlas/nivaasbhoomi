"use client";

import { useState } from "react";
import { Loader2, ArrowLeft, MessageCircle, ClipboardCheck, Printer, AlertTriangle, ExternalLink, Sparkles } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Logo } from "@/components/shared/logo";
import { useToolLead } from "@/components/tools/use-tool-lead";
import {
  allLegalStates,
  getLegalState,
  PROPERTY_TYPE_LABELS,
  PURCHASE_TYPE_LABELS,
  type ChecklistOutput,
  type ChecklistPropertyType,
  type ChecklistPurchaseType,
} from "@/data/legal-checklist";

const PROPERTY_TYPES = Object.entries(PROPERTY_TYPE_LABELS) as [ChecklistPropertyType, string][];
const PURCHASE_TYPES = Object.entries(PURCHASE_TYPE_LABELS) as [ChecklistPurchaseType, string][];

/** Property legal-checklist lead magnet. Inputs on-page; the personalised
 *  checklist + "Save as PDF" (print) unlock after a WhatsApp OTP (or instantly
 *  when logged in). Checklist is computed SERVER-SIDE. */
export function PropertyChecklistTool({ initialStateSlug }: { initialStateSlug?: string }) {
  const states = allLegalStates();
  const [stateSlug, setStateSlug] = useState(
    initialStateSlug && getLegalState(initialStateSlug) ? initialStateSlug : states[0]?.slug ?? "",
  );
  const [propertyType, setPropertyType] = useState<ChecklistPropertyType>("flat");
  const [purchaseType, setPurchaseType] = useState<ChecklistPurchaseType>("resale");
  const [phone, setPhone] = useState("");
  const [digits, setDigits] = useState("");

  const lead = useToolLead<ChecklistOutput>("legal_checklist");

  function generate() {
    lead.start({ stateSlug, propertyType, purchaseType });
  }

  if (lead.phase === "done" && lead.result) {
    return <ChecklistResult c={lead.result} onReset={() => window.location.reload()} />;
  }

  if (lead.phase === "phone" || lead.phase === "code") {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 rounded-card border border-border bg-surface p-6 shadow-card">
        <button type="button" onClick={lead.backToForm} className="inline-flex items-center gap-1 self-start text-meta font-medium text-clay-700 hover:underline">
          <ArrowLeft className="size-3.5" /> Back
        </button>
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-clay-600" />
          <h2 className="text-lg font-semibold text-ink-950">Get your checklist on WhatsApp</h2>
        </div>
        {lead.phase === "phone" ? (
          <>
            <p className="text-sm text-muted-foreground">
              Enter your WhatsApp number — we&apos;ll send a 6-digit code and unlock your printable
              legal checklist.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label required>WhatsApp number</Label>
              <div className="relative">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">+91</span>
                <Input type="tel" inputMode="numeric" autoComplete="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} className="pl-12" />
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
            <Input type="text" inputMode="numeric" maxLength={6} placeholder="6-digit code" value={digits} onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 6))} className="text-center text-lg font-semibold tracking-[0.3em]" />
            {lead.error && <p className="text-meta text-danger-700">{lead.error}</p>}
            <Button onClick={() => lead.verifyCode(phone.trim(), digits)} disabled={lead.busy || digits.length !== 6} block>
              {lead.busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Verify &amp; see my checklist
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
                  {s.specific ? " — state rules included" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Property type</Label>
          <Select value={propertyType} onValueChange={(v) => setPropertyType(v as ChecklistPropertyType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROPERTY_TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Purchase type</Label>
          <Select value={purchaseType} onValueChange={(v) => setPurchaseType(v as ChecklistPurchaseType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PURCHASE_TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {lead.error && <p className="text-meta text-danger-700">{lead.error}</p>}

        <Button onClick={generate} disabled={lead.busy} size="lg">
          {lead.busy ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
          Get my legal checklist
        </Button>
      </div>

      <div className="flex flex-col justify-center gap-3 rounded-card border border-dashed border-border bg-surface-muted/50 p-6">
        <Sparkles className="size-6 text-clay-600" />
        <h3 className="text-lg font-semibold text-ink-950">A printable due-diligence checklist</h3>
        <p className="text-sm text-muted-foreground">
          Documents to demand, checks to run and red flags to watch — tailored to your state,
          property type and purchase. Print it or save as PDF and tick it off.
        </p>
        <ul className="mt-1 flex flex-col gap-1.5 text-sm text-ink-800">
          <li>• Title, EC, mutation, tax, OC/RERA — as relevant</li>
          <li>• State-specific rules (e.g. Jharkhand CNT/SPT tribal land)</li>
          <li>• Red flags + official portal links</li>
        </ul>
      </div>
    </div>
  );
}

function ChecklistResult({ c, onReset }: { c: ChecklistOutput; onReset: () => void }) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 no-print">
        <h2 className="text-lg font-semibold text-ink-950">
          {c.stateName} · {c.propertyTypeLabel} · {c.purchaseTypeLabel}
        </h2>
        <div className="flex gap-2">
          <Button type="button" onClick={() => window.print()}>
            <Printer className="size-4" /> Print / Save as PDF
          </Button>
          <Button type="button" variant="outline" onClick={onReset}>Start over</Button>
        </div>
      </div>

      {/* Printable area (branded header + checklist + footer) */}
      <div className="nb-print-area rounded-card border border-border bg-surface p-6">
        {/* Print-only branded header */}
        <div className="print-only mb-4 border-b border-ink-200 pb-3">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-ink-950">NivaasBhoomi</span>
            <span className="text-sm text-ink-700">Property legal checklist</span>
          </div>
          <p className="mt-1 text-sm text-ink-700">
            {c.stateName} · {c.propertyTypeLabel} · {c.purchaseTypeLabel}
          </p>
        </div>

        {c.hasStateSpecific && (
          <p className="mb-4 rounded-control border border-clay-100 bg-clay-50 px-3 py-2 text-meta text-clay-800 no-print">
            Includes <b>{c.stateName}</b>-specific rules — the part most buyers miss.
          </p>
        )}

        <div className="flex flex-col gap-6">
          {c.sections.map((s, i) => (
            <section key={s.key} className="print-section">
              <h3 className="text-base font-semibold text-ink-950">
                {i + 1}. {s.title}
              </h3>
              <ul className="mt-2 flex flex-col gap-2">
                {s.items.map((it, j) => (
                  <li key={j} className="flex gap-2.5 text-sm">
                    <span className="mt-0.5 inline-block size-4 shrink-0 rounded-[3px] border border-ink-400" aria-hidden />
                    <span>
                      <span className="font-medium text-ink-900">{it.title}</span>
                      {it.detail && <span className="mt-0.5 block text-meta text-muted-foreground">{it.detail}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {/* Red flags */}
          <section className="print-section">
            <h3 className="flex items-center gap-1.5 text-base font-semibold text-danger-700">
              <AlertTriangle className="size-4" /> Red flags — walk away or get legal advice
            </h3>
            <ul className="mt-2 flex flex-col gap-1.5 text-sm text-ink-800">
              {c.redFlags.map((f, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden>•</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Portals */}
          {c.portals.length > 0 && (
            <section className="print-section">
              <h3 className="text-base font-semibold text-ink-950">Official portals</h3>
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {c.portals.map((p) => (
                  <li key={p.url}>
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-clay-700 hover:underline">
                      {p.label} <ExternalLink className="size-3.5 no-print" />
                    </a>
                    <span className="print-only text-meta text-ink-600"> — {p.url}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Disclaimer (screen + print) */}
        <div className="mt-6 rounded-control border border-warning-100 bg-warning-50 px-3 py-2 text-meta text-warning-700 print-section">
          <b>Disclaimer:</b> {c.disclaimer} Rates/rules last reviewed {c.lastUpdated}.
        </div>

        {/* Print-only footer */}
        <div className="print-only mt-4 border-t border-ink-200 pt-2 text-center text-xs text-ink-600">
          {c.disclaimer} · nivaasbhoomi.com
        </div>
      </div>
    </div>
  );
}
