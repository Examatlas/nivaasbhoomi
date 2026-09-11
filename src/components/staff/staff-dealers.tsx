"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Search, UserPlus, BadgeCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiClientError } from "@/lib/api/client";

interface StaffDealer {
  _id: string;
  name: string;
  businessName: string;
  phone: string;
  status: string;
  verificationTier: number;
  listingCount: number;
  mine: boolean;
}

function tierLabel(tier: number): string {
  return tier <= 0 ? "Unverified" : `Tier ${tier}`;
}

export function StaffDealers() {
  const [dealers, setDealers] = useState<StaffDealer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async (query: string) => {
    setError(null);
    try {
      const url = query.trim()
        ? `/api/staff/dealers?q=${encodeURIComponent(query.trim())}`
        : "/api/staff/dealers";
      setDealers(await apiFetch<StaffDealer[]>(url));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load dealers.");
      setDealers([]);
    }
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setDealers(null);
    void load(q);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={onSearch} className="relative flex-1 min-w-56 max-w-sm">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, business, phone"
            className="pl-9"
          />
        </form>
        <Button onClick={() => setShowForm((v) => !v)} variant={showForm ? "subtle" : "primary"}>
          <Plus className="size-4" /> Onboard dealer
        </Button>
      </div>

      {showForm && (
        <OnboardForm
          onDone={() => {
            setShowForm(false);
            setDealers(null);
            void load(q);
          }}
        />
      )}

      {error && <p className="text-sm text-danger-700">{error}</p>}

      {dealers === null ? (
        <div className="flex items-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : dealers.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-surface px-4 py-10 text-center text-sm text-muted-foreground">
          No dealers yet. Onboard your first dealer to get started.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="border-b border-border text-left text-meta text-muted-foreground">
                <th className="px-4 py-3 font-medium">Dealer</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Verification</th>
                <th className="px-4 py-3 font-medium">Listings</th>
                <th className="px-4 py-3 font-medium">Access</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {dealers.map((d) => (
                <tr key={d._id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink-950">{d.businessName}</div>
                    <div className="text-meta text-muted-foreground">{d.name}</div>
                  </td>
                  <td className="px-4 py-3 tabular text-muted-foreground">{d.phone}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-meta font-medium " +
                        (d.verificationTier > 0
                          ? "bg-success-50 text-success-700"
                          : "bg-surface-muted text-muted-foreground")
                      }
                    >
                      {d.verificationTier > 0 && <BadgeCheck className="size-3.5" />}
                      {tierLabel(d.verificationTier)}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular text-muted-foreground">{d.listingCount}</td>
                  <td className="px-4 py-3 text-meta text-muted-foreground">
                    {d.mine ? "Onboarded by you" : "Granted"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/staff/dealers/${d._id}`}
                      className="font-medium text-ink-700 hover:underline"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OnboardForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/staff/dealers", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          businessName: businessName.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
        }),
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to onboard dealer.");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-4 rounded-card border border-border bg-surface p-5 sm:grid-cols-2"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ob-business" required>
          Business name
        </Label>
        <Input id="ob-business" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ob-name" required>
          Contact person
        </Label>
        <Input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ob-phone" required>
          WhatsApp / mobile
        </Label>
        <Input
          id="ob-phone"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="10-digit mobile"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ob-email">Email (optional)</Label>
        <Input id="ob-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      {error && <p className="text-sm text-danger-700 sm:col-span-2">{error}</p>}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          Onboard dealer
        </Button>
      </div>
    </form>
  );
}
