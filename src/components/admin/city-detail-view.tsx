"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FaqEditor } from "@/components/admin/faq-editor";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import type { CityDetail, CityActivation, FaqItem } from "@/types/admin-locations";

function Requirement({
  label,
  have,
  need,
}: {
  label: string;
  have: number;
  need: number;
}) {
  const ok = have >= need;
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="flex items-center gap-2">
        <Icon className={ok ? "size-4 text-success-600" : "size-4 text-danger-500"} />
        {label}
      </span>
      <span
        className={`tabular font-medium ${ok ? "text-success-700" : "text-danger-600"}`}
      >
        {have} / {need}
      </span>
    </div>
  );
}

export function CityDetailView({ id }: { id: string }) {
  const [city, setCity] = useState<CityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable SEO fields
  const [introText, setIntroText] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [faq, setFaq] = useState<FaqItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);

  const load = () => {
    setLoading(true);
    apiFetch<CityDetail>(`/api/admin/locations/cities/${id}`)
      .then((c) => {
        setCity(c);
        setIntroText(c.introText);
        setMetaTitle(c.metaTitle);
        setMetaDescription(c.metaDescription);
        setFaq(c.faq);
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

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/admin/locations/cities/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ introText, metaTitle, metaDescription, faq }),
      });
      toast.success("City content saved");
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (active: boolean) => {
    setActivating(true);
    try {
      await apiFetch<{ isActive: boolean; activation?: CityActivation }>(
        `/api/admin/locations/cities/${id}/activate`,
        { method: "POST", body: JSON.stringify({ active }) },
      );
      toast.success(active ? "City activated" : "City deactivated");
      load();
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "VALIDATION_ERROR" && e.details) {
        const check = e.details as CityActivation;
        setCity((prev) => (prev ? { ...prev, activation: check } : prev));
        toast.error("City does not meet the activation guard yet.");
      } else {
        toast.error(e instanceof ApiClientError ? e.message : "Activation failed");
      }
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64 rounded-md" />
        <Skeleton className="h-40 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  if (error || !city) {
    return (
      <div className="rounded-card border border-danger-100 bg-danger-50 p-4 text-danger-700">
        {error ?? "City not found."}
      </div>
    );
  }

  const a = city.activation;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/locations"
          className="inline-flex items-center gap-1.5 text-meta text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to locations
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-display-sm">{city.name}</h1>
          <Badge tone={city.tier === 1 ? "ink" : city.tier === 2 ? "clay" : "neutral"}>
            Tier {city.tier}
          </Badge>
          {city.isActive ? (
            <Badge tone="success">Active</Badge>
          ) : (
            <Badge tone="neutral">Inactive</Badge>
          )}
          <span className="text-meta text-subtle-foreground">
            {city.state?.name} · /{city.slug}
          </span>
        </div>
      </div>

      {/* Activation guard */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-ink-950">Launch guard</h2>
            <p className="mt-0.5 text-meta text-muted-foreground">
              A city can go live only when all three thresholds are met (enforced
              server-side, Section 13).
            </p>
            <div className="mt-3 max-w-md divide-y divide-border">
              <Requirement
                label="Approved listings"
                have={a.counts.approvedListings}
                need={a.thresholds.approvedListings}
              />
              <Requirement
                label="Verified dealers (tier 1+)"
                have={a.counts.verifiedDealers}
                need={a.thresholds.verifiedDealers}
              />
              <Requirement
                label="Active localities"
                have={a.counts.activeLocalities}
                need={a.thresholds.activeLocalities}
              />
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-2">
            {city.isActive ? (
              <Button
                variant="outline"
                onClick={() => setActive(false)}
                disabled={activating}
              >
                {activating && <Loader2 className="animate-spin" />} Deactivate
              </Button>
            ) : (
              <Button onClick={() => setActive(true)} disabled={activating || !a.ok}>
                {activating && <Loader2 className="animate-spin" />} Activate city
              </Button>
            )}
            {!a.ok && !city.isActive && (
              <span className="max-w-[12rem] text-meta text-danger-600">
                {a.missing[0]}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* SEO content editor */}
      <Card className="p-5">
        <h2 className="mb-4 text-lg font-semibold text-ink-950">SEO content</h2>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="introText">
              Intro text{" "}
              <span className="text-meta font-normal text-subtle-foreground">
                (aim for 200+ words) · {introText.trim().length} chars
              </span>
            </Label>
            <Textarea
              id="introText"
              value={introText}
              onChange={(e) => setIntroText(e.target.value)}
              rows={6}
              placeholder="Describe the city for buyers and search engines…"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="metaTitle">Meta title</Label>
              <Input
                id="metaTitle"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                placeholder="55–60 characters"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="metaDescription">Meta description</Label>
              <Input
                id="metaDescription"
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                placeholder="150–160 characters"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>FAQ</Label>
            <FaqEditor value={faq} onChange={setFaq} />
          </div>
          <div>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} Save content
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
