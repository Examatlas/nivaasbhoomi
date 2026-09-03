"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { useDebouncedValue } from "@/components/admin/use-debounced-value";
import type { Paginated } from "@/types/admin-locations";

interface PaginatedPanelProps<T> {
  /** Builds the endpoint for a given search term and page. */
  endpoint: (params: { q: string; page: number; limit: number }) => string;
  /** Render one row. */
  renderRow: (item: T, reload: () => void) => React.ReactNode;
  columns: string[];
  searchPlaceholder: string;
  emptyLabel: string;
  limit?: number;
  /** Bump this to force a reload from a parent (e.g. after an action). */
  reloadKey?: number;
}

/**
 * Generic server-paginated, server-searched list panel. Never loads a whole
 * collection - always page + search on the server (there are ~162k localities).
 */
export function PaginatedPanel<T>({
  endpoint,
  renderRow,
  columns,
  searchPlaceholder,
  emptyLabel,
  limit = 25,
  reloadKey = 0,
}: PaginatedPanelProps<T>) {
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 350);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localReload, setLocalReload] = useState(0);

  const url = useMemo(
    () => endpoint({ q: debouncedQ, page, limit }),
    [endpoint, debouncedQ, page, limit],
  );

  // Data-fetching effect: loading/error/data mirror an external system (the
  // API) into React state, which is a legitimate effect. The synchronous
  // setLoading/setError here is intentional (show the spinner immediately when
  // the query changes), so the set-state-in-effect rule is silenced for it.
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    apiFetch<Paginated<T>>(url)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof ApiClientError ? e.message : "Failed to load.");
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url, reloadKey, localReload]);

  const reload = () => setLocalReload((n) => n + 1);

  // Typing resets to page 1 immediately (handled here, not in an effect).
  const onSearchChange = (value: string) => {
    setQ(value);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-md">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9"
        />
      </div>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted/60">
              {columns.map((c) => (
                <th
                  key={c}
                  className="px-4 py-2.5 text-overline font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c} className="px-4 py-3">
                      <Skeleton className="h-4 w-24 rounded-md" />
                    </td>
                  ))}
                </tr>
              ))}

            {!loading && error && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-danger-600"
                >
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && data && data.items.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  {emptyLabel}
                </td>
              </tr>
            )}

            {!loading && !error && data?.items.map((item) => renderRow(item, reload))}
          </tbody>
        </table>
      </div>

      {data && data.total > 0 && (
        <div className="flex items-center justify-between text-meta text-muted-foreground">
          <span>
            {(data.page - 1) * data.limit + 1}–
            {Math.min(data.page * data.limit, data.total)} of{" "}
            {data.total.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft /> Prev
            </Button>
            <span className="tabular">
              {data.page} / {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page >= data.totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
