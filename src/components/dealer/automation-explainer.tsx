import { Fragment } from "react";
import {
  Link2,
  MessageCircle,
  Send,
  Bot,
  CalendarCheck,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Check,
  Minus,
  X,
  IndianRupee,
  Clock,
  UserCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const STEPS = [
  { icon: Link2, title: "Connect your WhatsApp", body: "Link your Zenith-registered number once." },
  {
    icon: MessageCircle,
    title: "Your listings switch to WhatsApp",
    body: "Every property card and page shows a WhatsApp button instead of Contact Us.",
  },
  {
    icon: Send,
    title: "Buyers message you directly",
    body: "The enquiry lands on your own WhatsApp, with the property reference attached.",
  },
  {
    icon: Bot,
    title: "The AI agent answers",
    body: "It handles their questions about the property, shares the price, and keeps the conversation going even at 11pm.",
  },
  {
    icon: CalendarCheck,
    title: "The visit gets booked",
    body: "When the buyer wants to see the property, the agent checks your available slots and books the visit then and there — if that slot is taken it offers the next one, and the booking is confirmed automatically.",
  },
];

const WITHOUT = [
  "Enquiries missed after hours.",
  "Slow replies lose the buyer to whoever answered first.",
  "The same questions answered fifty times a day.",
  "Chasing people to fix a visit time.",
];

const WITH = [
  "Instant reply, every time.",
  "Questions and pricing handled automatically.",
  "Site visits booked into your calendar without you touching the phone.",
  "You show up to a buyer who is already serious.",
];

const FEATURES = [
  { icon: MessageCircle, text: "Answers buyer questions about the property" },
  { icon: IndianRupee, text: "Shares pricing" },
  { icon: Clock, text: "Replies instantly, 24/7" },
  { icon: UserCheck, text: "Qualifies the buyer before you spend time on them" },
  {
    icon: CalendarCheck,
    text: "Books site visits automatically against your available slots, and offers the next slot when one is taken",
  },
  { icon: Smartphone, text: "Every conversation stays on your own WhatsApp number" },
];

const FAQS = [
  {
    q: "Is this included with NivaasBhoomi?",
    a: "No — Zenith Code is a separate product. Connecting is optional, and your leads keep flowing to this dashboard either way.",
  },
  {
    q: "Do I need a separate WhatsApp number?",
    a: "It uses your Zenith-registered number, which may differ from your NivaasBhoomi contact number.",
  },
  {
    q: "Do I have to approve each site visit?",
    a: "No — the agent books against your available slots and confirms directly.",
  },
  {
    q: "What happens if I disconnect?",
    a: "Your listing buttons revert to Contact Us, and leads keep coming through NivaasBhoomi.",
  },
  {
    q: "Who owns the leads?",
    a: "You do — the conversation is on your own WhatsApp number.",
  },
  {
    q: "Can one Zenith account connect to more than one dealer profile?",
    a: "No — it's a one-to-one binding.",
  },
];

/**
 * Product explainer below the Connect card on /dealer/automation. Pure server
 * component — the accordions and the connected-state collapse are native
 * <details>, so there's no client JS or new dependency. Claims nothing beyond
 * the live capabilities passed in the copy above.
 */
export function AutomationExplainer({ connected }: { connected: boolean }) {
  // Connected: the dealer already bought in — collapse the pitch behind a toggle
  // so Disconnect stays close, but keep it available.
  if (connected) {
    return (
      <details className="group mt-8 rounded-card border border-border bg-surface shadow-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2 text-sm font-semibold text-ink-950">
            <Sparkles className="size-4 text-clay-700" /> How it works
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-border p-5 sm:p-6">
          <ExplainerBody />
        </div>
      </details>
    );
  }

  // Not connected: the explainer IS the pitch — fully expanded, CTA at the end.
  return (
    <div className="mt-8">
      <ExplainerBody />
      <div className="mt-8 flex flex-col items-center gap-3 rounded-card border border-clay-100 bg-clay-50/60 px-6 py-7 text-center">
        <h3 className="text-lg font-semibold text-ink-950">Ready to let the agent handle it?</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          Connect your Zenith-registered WhatsApp number to switch your listings over.
        </p>
        <Button asChild size="lg" className="mt-1">
          <a href="#zenith-connect">
            Connect your WhatsApp <ArrowUp className="size-4" />
          </a>
        </Button>
      </div>
    </div>
  );
}

function ExplainerBody() {
  return (
    <div className="flex flex-col gap-10">
      {/* SECTION 1 — pipeline */}
      <section>
        <h3 className="text-lg font-semibold text-ink-950">How it works</h3>
        <p className="mt-1 text-meta text-muted-foreground">
          From one WhatsApp connection to a booked site visit.
        </p>
        <ol className="mt-5 flex flex-col sm:flex-row sm:items-start">
          {STEPS.map((s, i) => (
            <Fragment key={s.title}>
              <li className="flex gap-3 sm:flex-1 sm:flex-col sm:items-center sm:text-center">
                <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-clay-50 text-clay-700">
                  <s.icon className="size-5" />
                  <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-clay-700 text-[0.625rem] font-semibold text-white">
                    {i + 1}
                  </span>
                </span>
                <div className="sm:mt-1 sm:px-1">
                  <p className="text-sm font-semibold text-ink-950">{s.title}</p>
                  <p className="mt-0.5 text-meta text-muted-foreground">{s.body}</p>
                </div>
              </li>
              {i < STEPS.length - 1 && (
                <li
                  aria-hidden
                  className="flex shrink-0 items-center justify-start pl-[0.875rem] py-1.5 text-ink-300 sm:justify-center sm:px-1 sm:pt-4 sm:pb-0 sm:pl-0"
                >
                  <ArrowDown className="size-4 sm:hidden" />
                  <ArrowRight className="hidden size-4 sm:block" />
                </li>
              )}
            </Fragment>
          ))}
        </ol>
      </section>

      {/* SECTION 2 — before / after */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-card border border-border bg-surface-muted p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-800">
            <span className="flex size-6 items-center justify-center rounded-full bg-ink-50 text-ink-700">
              <X className="size-3.5" />
            </span>
            Without automation
          </h3>
          <ul className="mt-3 flex flex-col gap-2.5">
            {WITHOUT.map((t) => (
              <li key={t} className="flex gap-2 text-sm text-ink-700">
                <Minus className="mt-0.5 size-4 shrink-0 text-ink-400" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-card border border-clay-100 bg-clay-50/60 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-950">
            <span className="flex size-6 items-center justify-center rounded-full bg-clay-100 text-clay-700">
              <Check className="size-3.5" />
            </span>
            With Zenith Code
          </h3>
          <ul className="mt-3 flex flex-col gap-2.5">
            {WITH.map((t) => (
              <li key={t} className="flex gap-2 text-sm text-ink-800">
                <Check className="mt-0.5 size-4 shrink-0 text-clay-700" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* SECTION 3 — feature grid */}
      <section>
        <h3 className="text-lg font-semibold text-ink-950">What the AI agent handles</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.text}
              className="flex items-start gap-3 rounded-card border border-border bg-surface p-4"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-clay-50 text-clay-700">
                <f.icon className="size-5" />
              </span>
              <p className="text-sm text-ink-800">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 4 — FAQ */}
      <section>
        <h3 className="text-lg font-semibold text-ink-950">Common questions</h3>
        <div className="mt-4 flex flex-col gap-2">
          {FAQS.map((f) => (
            <details key={f.q} className="group rounded-card border border-border bg-surface">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-medium text-ink-950 [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-4 pb-4 text-sm text-muted-foreground">{f.a}</div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
