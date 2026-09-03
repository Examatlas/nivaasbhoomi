import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { PlusCircle, Camera, Clock } from "lucide-react";

import { getMyListings, type MyListingRow } from "@/lib/listings/dealer";
import { DealerShell } from "@/components/dealer/dealer-shell";
import { ListingActions } from "@/components/dealer/listing-actions";
import { Badge } from "@/components/ui/badge";
import { formatListingPrice } from "@/lib/utils/price";

export const metadata: Metadata = {
  title: "My Listings",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "danger" | "ink"> = {
  draft: "neutral",
  pending: "warning",
  "pending-location": "warning",
  approved: "success",
  rejected: "danger",
  expired: "ink",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending: "In review",
  "pending-location": "Locality pending",
  approved: "Live",
  rejected: "Rejected",
  expired: "Expired",
};

export default async function MyListingsPage({
  searchParams,
}: PageProps<"/dealer/listings">) {
  const rows = await getMyListings();
  if (rows === null) redirect("/dealer/login");

  const sp = await searchParams;
  const justSubmitted = sp.submitted === "1";

  return (
    <DealerShell active="/dealer/listings">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-display-sm">My listings</h1>
          <p className="mt-1 text-muted-foreground">{rows.length} total</p>
        </div>
        <Link
          href="/dealer/listings/new"
          className="inline-flex items-center gap-1.5 rounded-control bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        >
          <PlusCircle className="size-4" /> Add listing
        </Link>
      </div>

      {justSubmitted && (
        <div className="mb-6 rounded-card border border-success-100 bg-success-50 px-4 py-3 text-sm text-success-700">
          Listing submitted for review. We&apos;ll notify you once it&apos;s approved.
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-card border border-border bg-surface px-4 py-16 text-center">
          <p className="text-muted-foreground">You haven&apos;t added any listings yet.</p>
          <Link
            href="/dealer/listings/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-control bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <PlusCircle className="size-4" /> Add your first listing
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </ul>
      )}
    </DealerShell>
  );
}

function ListingCard({ listing: l }: { listing: MyListingRow }) {
  const price = l.price ? formatListingPrice(l.purpose, l.price) : null;
  const expiringSoon = l.daysToExpiry != null && l.daysToExpiry <= 5;
  const thumb =
    l.thumb && (l.thumb.startsWith("https://res.cloudinary.com/") || l.thumb.startsWith("/"))
      ? l.thumb
      : undefined;

  return (
    <li className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3 sm:flex-row sm:items-center">
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-control bg-sand-200 sm:size-24">
        {thumb ? (
          <Image src={thumb} alt={l.title} fill sizes="96px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sand-400">
            <Camera className="size-6" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[l.status] ?? "neutral"} size="sm">
            {STATUS_LABEL[l.status] ?? l.status}
          </Badge>
          {price && (
            <span className="text-price text-ink-950 tabular">
              {price.primary}
              {price.suffix && (
                <span className="ml-1 text-sm font-medium text-muted-foreground">
                  {price.suffix}
                </span>
              )}
            </span>
          )}
        </div>
        <p className="mt-1 line-clamp-1 font-medium text-ink-950">{l.title}</p>
        <p className="text-meta text-muted-foreground">
          {[l.localityName, l.cityName].filter(Boolean).join(", ")}
        </p>
        {l.status === "rejected" && l.rejectionReason && (
          <p className="mt-1 text-meta text-danger-700">Reason: {l.rejectionReason}</p>
        )}
        {l.daysToExpiry != null && (
          <p
            className={
              "mt-1 inline-flex items-center gap-1 text-meta " +
              (expiringSoon ? "text-warning-700" : "text-muted-foreground")
            }
          >
            <Clock className="size-3.5" />
            {l.daysToExpiry > 0
              ? `Expires in ${l.daysToExpiry} day${l.daysToExpiry === 1 ? "" : "s"}`
              : "Expired — refresh to relist"}
          </p>
        )}
      </div>

      <div className="sm:self-center">
        <ListingActions id={l.id} status={l.status} />
      </div>
    </li>
  );
}
