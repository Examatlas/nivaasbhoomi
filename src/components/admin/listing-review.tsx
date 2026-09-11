"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Check, X, Loader2, Star, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { REJECT_REASONS } from "@/lib/listings/reject-reasons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { VerificationBadge } from "@/components/public/verification-badge";
import { NotificationStatus } from "@/components/admin/notification-status";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import {
  formatListingPrice,
  formatBhk,
  formatPropertyType,
  formatArea,
} from "@/lib/utils/price";
import type { ListingDetail } from "@/types/admin-listings";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

export function ListingReview({ id }: { id: string }) {
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [notifKey, setNotifKey] = useState(0);
  const canReject = reasons.length > 0 || note.trim().length > 0;

  const load = () => {
    setLoading(true);
    apiFetch<ListingDetail>(`/api/admin/listings/${id}`)
      .then((l) => {
        setListing(l);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiClientError ? e.message : "Failed to load."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const action = async (path: string, body?: unknown, okMsg?: string) => {
    setWorking(true);
    try {
      await apiFetch(`/api/admin/listings/${id}/${path}`, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      });
      if (okMsg) toast.success(okMsg);
      load();
      // The dealer WhatsApp notification is sent AFTER the response (non-blocking),
      // so refresh the indicator now and again shortly after it lands.
      setNotifKey((k) => k + 1);
      setTimeout(() => setNotifKey((k) => k + 1), 3000);
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Action failed");
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-72 rounded-md" />
        <Skeleton className="h-56 w-full rounded-card" />
      </div>
    );
  }
  if (error || !listing) {
    return (
      <div className="rounded-card border border-danger-100 bg-danger-50 p-4 text-danger-700">
        {error ?? "Listing not found."}
      </div>
    );
  }

  const l = listing;
  const price = formatListingPrice(
    l.purpose,
    l.purpose === "rent" ? (l.monthlyRent ?? 0) : (l.expectedPrice ?? 0),
  );
  const badges = l.badges ?? {};

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div>
        <Link
          href="/admin/listings"
          className="inline-flex items-center gap-1.5 text-meta text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to listings
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-display-sm">{l.title}</h1>
          <Badge
            tone={
              l.status === "approved"
                ? "success"
                : l.status === "rejected"
                  ? "danger"
                  : "warning"
            }
          >
            {l.status}
          </Badge>
        </div>
        <p className="mt-1 text-meta text-muted-foreground">
          {l.locality?.name}, {l.city?.name} · {l.state?.name}
        </p>
        {l.status === "rejected" && l.rejectionReason && (
          <p className="mt-2 rounded-control border border-danger-100 bg-danger-50 px-3 py-2 text-meta text-danger-700">
            Rejection reason: {l.rejectionReason}
          </p>
        )}
      </div>

      {/* Actions */}
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <Button
          onClick={() => action("approve", undefined, "Listing approved")}
          disabled={working || l.status === "approved"}
        >
          {working ? <Loader2 className="animate-spin" /> : <Check />} Approve
        </Button>
        <Button variant="danger" onClick={() => setRejectOpen(true)} disabled={working}>
          <X /> Reject
        </Button>
        <div className="mx-1 h-6 w-px bg-border" />
        <Button
          variant={badges.documentsChecked ? "subtle" : "outline"}
          size="sm"
          onClick={() =>
            action("badges", { documentsChecked: !badges.documentsChecked }, "Updated")
          }
          disabled={working}
        >
          <ShieldCheck />{" "}
          {badges.documentsChecked ? "Documents checked ✓" : "Mark documents checked"}
        </Button>
        <Button
          variant={badges.photosVerified ? "subtle" : "outline"}
          size="sm"
          onClick={() =>
            action("badges", { photosVerified: !badges.photosVerified }, "Updated")
          }
          disabled={working}
        >
          <ShieldCheck />{" "}
          {badges.photosVerified ? "Photos verified ✓" : "Mark photos verified"}
        </Button>
        <div className="ml-auto flex items-center gap-3">
          <NotificationStatus entityId={id} refreshKey={notifKey} />
          <Button asChild variant="ghost" size="sm">
            <Link href={`/admin/locations/cities/${l.cityId}`}>City activation →</Link>
          </Button>
        </div>
      </Card>

      {/* Gallery */}
      {l.photos && l.photos.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-3 text-lg font-semibold text-ink-950">
            Photos ({l.photos.length})
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {l.photos.map((p, i) => (
              <div
                key={p.publicId}
                className={`relative aspect-[4/3] overflow-hidden rounded-media border ${
                  i === (l.coverPhotoIndex ?? 0)
                    ? "border-ink-500 ring-2 ring-ink-500/30"
                    : "border-border"
                }`}
              >
                <Image
                  src={p.url}
                  alt=""
                  fill
                  sizes="(max-width:640px) 50vw, 200px"
                  className="object-cover"
                />
                {i === (l.coverPhotoIndex ?? 0) && (
                  <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-ink-900 px-2 py-0.5 text-overline font-semibold text-white">
                    <Star className="size-3 fill-current" /> Cover
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Fields */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-2 text-lg font-semibold text-ink-950">Details</h2>
          <p className="mb-3 text-price text-ink-950">
            {price.primary}
            {price.suffix ? (
              <span className="text-sm font-normal text-muted-foreground">
                {price.suffix}
              </span>
            ) : null}
          </p>
          <div className="divide-y divide-border">
            <Row label="Purpose" value={l.purpose} />
            <Row label="Type" value={formatPropertyType(l.propertyType)} />
            <Row label="BHK" value={l.bhk ? formatBhk(l.bhk) : undefined} />
            <Row label="Bathrooms" value={l.bathrooms} />
            <Row
              label="Carpet area"
              value={l.carpetArea ? formatArea(l.carpetArea) : undefined}
            />
            <Row
              label="Built-up area"
              value={l.builtUpArea ? formatArea(l.builtUpArea) : undefined}
            />
            <Row
              label="Plot area"
              value={l.plotArea ? formatArea(l.plotArea) : undefined}
            />
            <Row
              label="Price / sq.ft."
              value={
                l.pricePerSqft ? `₹${l.pricePerSqft.toLocaleString("en-IN")}` : undefined
              }
            />
            <Row
              label="Floor"
              value={
                l.floor != null
                  ? `${l.floor}${l.totalFloors ? ` / ${l.totalFloors}` : ""}`
                  : undefined
              }
            />
            <Row label="Furnishing" value={l.furnishing} />
            <Row label="Facing" value={l.facing} />
            <Row label="Age" value={l.ageOfProperty} />
            <Row label="Amenities" value={l.amenities?.join(", ")} />
            <Row label="Parking" value={l.parking} />
            <Row label="Possession" value={l.possessionStatus} />
            <Row label="CNT land" value={l.isCntLand ? "Declared by dealer" : undefined} />
            <Row label="RERA" value={l.reraNumber} />
            <Row label="Brokerage" value={l.brokerage} />
            <Row
              label="Maintenance"
              value={
                l.maintenanceCharge
                  ? `₹${l.maintenanceCharge.toLocaleString("en-IN")}`
                  : undefined
              }
            />
            <Row label="Full address (private)" value={l.fullAddress} />
            <Row
              label="Coordinates"
              value={l.lat != null && l.lng != null ? `${l.lat}, ${l.lng}` : undefined}
            />
            <Row label="Slug" value={l.slug} />
            <Row
              label="Expires"
              value={l.expiresAt ? new Date(l.expiresAt).toLocaleDateString() : undefined}
            />
          </div>
          <div className="mt-4">
            <p className="text-meta text-subtle-foreground uppercase">Description</p>
            <p className="mt-1 text-sm whitespace-pre-wrap text-foreground">
              {l.description}
            </p>
          </div>
        </Card>

        {/* Dealer */}
        <Card className="h-fit p-5">
          <h2 className="mb-3 text-lg font-semibold text-ink-950">Owner</h2>
          {l.dealer ? (
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium text-ink-950">{l.dealer.businessName}</span>
                <VerificationBadge tier={l.dealer.verificationTier} size="sm" />
              </div>
              <Row label="Contact" value={l.dealer.name} />
              <Row label="Phone" value={l.dealer.phone} />
              <Row label="Tier" value={l.dealer.verificationTier} />
              <Row
                label="Rating"
                value={
                  l.dealer.ratingCount > 0
                    ? `${l.dealer.rating} (${l.dealer.ratingCount})`
                    : "No reviews"
                }
              />
              <Row label="Status" value={l.dealer.status} />
              {l.dealer.verificationTier < 1 && (
                <p className="mt-2 rounded-control border border-warning-100 bg-warning-50 px-3 py-2 text-meta text-warning-700">
                  Tier 0 dealer — this listing cannot be approved until the dealer is
                  verified.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Dealer not found.</p>
          )}
        </Card>
      </div>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this listing?</DialogTitle>
            <DialogDescription>
              Pick one or more reasons and/or add a note. At least one is required — the
              dealer sees the full reason and can edit and resubmit.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            {REJECT_REASONS.map((r) => (
              <label key={r.value} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={reasons.includes(r.value)}
                  onCheckedChange={(c) =>
                    setReasons((prev) =>
                      c ? [...prev, r.value] : prev.filter((v) => v !== r.value),
                    )
                  }
                />
                {r.label}
              </label>
            ))}
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Add any specific detail for the dealer"
          />

          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!canReject || working}
              onClick={async () => {
                await action("reject", { reasons, note }, "Listing rejected");
                setRejectOpen(false);
                setReasons([]);
                setNote("");
              }}
            >
              Reject listing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
