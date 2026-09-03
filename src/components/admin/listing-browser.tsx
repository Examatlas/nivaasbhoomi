"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { PaginatedPanel } from "@/components/admin/paginated-panel";
import { formatListingPrice, formatBhk, formatPropertyType } from "@/lib/utils/price";
import type { ListingRow, ListingStatus } from "@/types/admin-listings";

const STATUS_TONES: Record<string, "ink" | "success" | "warning" | "danger" | "neutral"> =
  {
    draft: "neutral",
    pending: "warning",
    "pending-location": "warning",
    approved: "success",
    rejected: "danger",
    expired: "neutral",
  };

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "draft", label: "Draft" },
  { value: "expired", label: "Expired" },
  { value: "pending-location", label: "Pending location" },
];

export function ListingBrowser() {
  const [status, setStatus] = useState("all");

  const endpoint = useCallback(
    ({ q, page, limit }: { q: string; page: number; limit: number }) => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q) params.set("q", q);
      if (status !== "all") params.set("status", status);
      return `/api/admin/listings?${params.toString()}`;
    },
    [status],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-48">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button asChild>
          <Link href="/admin/listings/new">
            <Plus /> New listing
          </Link>
        </Button>
      </div>

      <PaginatedPanel<ListingRow>
        endpoint={endpoint}
        columns={["Photo", "Listing", "Dealer", "City", "Price", "Status"]}
        searchPlaceholder="Search by title…"
        emptyLabel="No listings found."
        renderRow={(l) => {
          const price = formatListingPrice(l.purpose, l.price);
          return (
            <tr key={l._id} className="hover:bg-surface-muted/40">
              <td className="px-4 py-2.5">
                <div className="relative h-11 w-14 overflow-hidden rounded-md bg-sand-200">
                  {l.coverUrl && (
                    <Image
                      src={l.coverUrl}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  )}
                </div>
              </td>
              <td className="px-4 py-2.5">
                <Link
                  href={`/admin/listings/${l._id}`}
                  className="font-medium text-ink-950 hover:underline"
                >
                  {l.title}
                </Link>
                <div className="text-meta text-muted-foreground">
                  {l.bhk ? `${formatBhk(l.bhk)} · ` : ""}
                  {formatPropertyType(l.propertyType)} · {l.purpose}
                </div>
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">{l.dealerName}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{l.cityName}</td>
              <td className="tabular px-4 py-2.5 font-medium text-ink-950">
                {price.primary}
                {price.suffix ? (
                  <span className="text-meta font-normal text-muted-foreground">
                    {price.suffix}
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-2.5">
                <Badge tone={STATUS_TONES[l.status] ?? "neutral"} size="sm">
                  {l.status}
                </Badge>
              </td>
            </tr>
          );
        }}
      />
    </div>
  );
}

export type { ListingStatus };
