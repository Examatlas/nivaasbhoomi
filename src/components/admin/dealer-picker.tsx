"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, BadgeCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { useDebouncedValue } from "@/components/admin/use-debounced-value";
import type { DealerLite } from "@/types/admin-listings";
import type { Paginated } from "@/types/admin-locations";

/**
 * Dealer selector for the listing form. Search existing dealers, or quick-create
 * one (marking the documents the admin has verified, which sets the tier). A
 * listing can only be approved once its dealer is Tier 1+, so the quick-create
 * exposes the verification checkboxes up front.
 */
export function DealerPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (dealerId: string, dealer?: DealerLite) => void;
}) {
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);
  const [dealers, setDealers] = useState<DealerLite[]>([]);
  const [creating, setCreating] = useState(false);

  // create form
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [pan, setPan] = useState(true);
  const [aadhaar, setAadhaar] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Paginated<DealerLite>>(
      `/api/admin/dealers?limit=20${debouncedQ ? `&q=${encodeURIComponent(debouncedQ)}` : ""}`,
    )
      .then((d) => setDealers(d.items))
      .catch(() => setDealers([]));
  }, [debouncedQ]);

  const create = async () => {
    setSaving(true);
    try {
      const dealer = await apiFetch<DealerLite>("/api/admin/dealers", {
        method: "POST",
        body: JSON.stringify({
          name,
          businessName,
          phone,
          verified: { pan, aadhaar },
        }),
      });
      toast.success(`Dealer created (Tier ${dealer.verificationTier})`);
      setDealers((d) => [dealer, ...d]);
      onChange(dealer._id, dealer);
      setCreating(false);
      setName("");
      setBusinessName("");
      setPhone("");
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Could not create dealer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Select
            value={value || undefined}
            onValueChange={(id) =>
              onChange(
                id,
                dealers.find((d) => d._id === id),
              )
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a dealer (owner)" />
            </SelectTrigger>
            <SelectContent>
              <div className="p-1">
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search dealers…"
                  className="h-9"
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
              {dealers.map((d) => (
                <SelectItem key={d._id} value={d._id}>
                  {d.businessName} · {d.phone} · Tier {d.verificationTier}
                </SelectItem>
              ))}
              {dealers.length === 0 && (
                <p className="px-3 py-2 text-meta text-muted-foreground">
                  No dealers found.
                </p>
              )}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" onClick={() => setCreating((c) => !c)}>
          <Plus /> New
        </Button>
      </div>

      {creating && (
        <div className="flex flex-col gap-3 rounded-control border border-border bg-surface-muted/40 p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label required>Contact name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label required>Business name</Label>
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label required>Phone (with 91)</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9198XXXXXXXX"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-meta text-muted-foreground">
              <BadgeCheck className="size-4" /> Mark verified:
            </span>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={pan} onCheckedChange={(v) => setPan(v === true)} /> PAN
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={aadhaar}
                onCheckedChange={(v) => setAadhaar(v === true)}
              />{" "}
              Aadhaar
            </label>
            <Badge tone="neutral" size="sm">
              {pan && aadhaar ? "→ Tier 1" : "→ Tier 0 (can't go live)"}
            </Badge>
          </div>
          <div>
            <Button
              type="button"
              size="sm"
              onClick={create}
              disabled={saving || !name || !businessName || !phone}
            >
              {saving && <Loader2 className="animate-spin" />} Create dealer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
