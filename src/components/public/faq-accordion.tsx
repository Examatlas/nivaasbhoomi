import { ChevronDown } from "lucide-react";

/**
 * FAQ accordion using native <details>/<summary> - accessible and zero JS
 * (keeps the mobile bundle small). Pair with faqPageJsonLd for rich results.
 */
export function FaqAccordion({ faqs }: { faqs: { question: string; answer: string }[] }) {
  if (faqs.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {faqs.map((f, i) => (
        <details
          key={i}
          className="group rounded-card border border-border bg-surface open:shadow-subtle"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 text-sm font-medium text-ink-950 marker:hidden [&::-webkit-details-marker]:hidden">
            {f.question}
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">
            {f.answer}
          </div>
        </details>
      ))}
    </div>
  );
}
