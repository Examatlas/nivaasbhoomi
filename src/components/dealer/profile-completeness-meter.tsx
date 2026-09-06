import { Check, Circle, Search } from "lucide-react";

import type { ProfileCompleteness } from "@/lib/dealers/account";

/**
 * Profile-completeness meter. Shows the percentage filled and, crucially, EXACTLY
 * what is still missing to qualify for search indexing (the incentive to fill the
 * profile in). Pure presentational — safe as a server component.
 */
export function ProfileCompletenessMeter({
  completeness,
}: {
  completeness: ProfileCompleteness;
}) {
  const { percent, qualifiesForIndex, items } = completeness;
  const missingForIndex = items.filter((i) => i.forIndex && !i.done);

  return (
    <section className="rounded-card border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink-950">Profile completeness</h2>
        <span className="tabular text-sm font-semibold text-ink-900">{percent}%</span>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className={"h-full rounded-full " + (qualifiesForIndex ? "bg-success-600" : "bg-clay-500")}
          style={{ width: `${percent}%` }}
        />
      </div>

      {qualifiesForIndex ? (
        <p className="mt-3 inline-flex items-center gap-1.5 text-meta text-success-700">
          <Search className="size-4" /> Your profile qualifies to appear in search.
        </p>
      ) : (
        <div className="mt-3 rounded-control border border-warning-100 bg-warning-50 px-3 py-2">
          <p className="flex items-center gap-1.5 text-meta font-medium text-warning-700">
            <Search className="size-4" /> To appear in Google search, finish:
          </p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {missingForIndex.map((i) => (
              <li key={i.label} className="flex items-center gap-2 text-meta text-warning-700">
                <Circle className="size-3" /> {i.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.label} className="flex items-center gap-2 text-meta">
            <span
              className={
                "inline-flex size-4 shrink-0 items-center justify-center rounded-full " +
                (i.done ? "bg-success-600 text-white" : "border border-border text-transparent")
              }
            >
              {i.done ? <Check className="size-3" /> : null}
            </span>
            <span className={i.done ? "text-muted-foreground line-through" : "text-ink-800"}>
              {i.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
