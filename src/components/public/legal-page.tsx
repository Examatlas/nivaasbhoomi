import type { ReactNode } from "react";

/**
 * Shared shell for the legal / info pages: readable prose, ~800px measure, and
 * consistent heading / list styling scoped to the content (so each page is just
 * semantic HTML). No table of contents by request.
 */
export function LegalPage({
  title,
  lastUpdated,
  intro,
  children,
}: {
  title: string;
  lastUpdated?: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-[50rem] px-4 py-12 sm:px-6">
      <h1 className="text-display-sm">{title}</h1>
      {lastUpdated && (
        <p className="mt-2 text-meta text-muted-foreground">Last updated: {lastUpdated}</p>
      )}
      {intro && <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-800">{intro}</p>}
      <div
        className={
          "mt-8 flex flex-col gap-5 text-[0.95rem] leading-relaxed text-ink-800 " +
          "[&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink-950 " +
          "[&_h3]:mt-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-ink-950 " +
          "[&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5 [&_li]:list-disc [&_li]:marker:text-clay-500 " +
          "[&_a]:font-medium [&_a]:text-clay-700 [&_a]:underline [&_strong]:text-ink-950"
        }
      >
        {children}
      </div>
    </article>
  );
}

/** A titled section: <h2> + body. */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
