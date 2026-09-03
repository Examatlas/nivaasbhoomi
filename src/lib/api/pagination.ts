import type { NextRequest } from "next/server";

/** Parsed list query: 1-based page, bounded limit, trimmed search term. */
export interface ListQuery {
  page: number;
  limit: number;
  skip: number;
  q: string;
}

export function parseListQuery(
  req: NextRequest,
  defaultLimit = 25,
  maxLimit = 100,
): ListQuery {
  const p = req.nextUrl.searchParams;
  const page = Math.max(1, Number.parseInt(p.get("page") ?? "1", 10) || 1);
  const limitRaw =
    Number.parseInt(p.get("limit") ?? String(defaultLimit), 10) || defaultLimit;
  const limit = Math.min(maxLimit, Math.max(1, limitRaw));
  const q = (p.get("q") ?? "").trim();
  return { page, limit, skip: (page - 1) * limit, q };
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function paginated<T>(items: T[], total: number, query: ListQuery): Paginated<T> {
  return {
    items,
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

/** Escape a user search term for safe use inside a RegExp. */
export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
