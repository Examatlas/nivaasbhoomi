"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import type {
  LocalityDetail,
  LocalityActivation,
  FaqItem,
} from "@/types/admin-locations";

export function LocalityDetailView({ id }: { id: string }) {
  const router = useRouter();
  const [loc, setLoc] = useState<LocalityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [introText, setIntroText] = useState("");
  const [connectivity, setConnectivity] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [faq, setFaq] = useState<FaqItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);

  const load = () => {
    setLoading(true);
    apiFetch<LocalityDetail>(`/api/admin/locations/localities/${id}`)
      .then((l) => {
        setLoc(l);
        setIntroText(l.introText);
        setConnectivity(l.connectivity);
        setMetaTitle(l.metaTitle);
        setMetaDescription(l.metaDescription);
        setFaq(l.faq);
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
      const res = await apiFetch<{ activation: LocalityActivation }>(
        `/api/admin/locations/localities/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            introText,
            connectivity,
            metaTitle,
            metaDescription,
            faq,
          }),
        },
      );
      toast.success(
        res.activation.isActive ? "Saved — locality is now live" : "Saved (not yet live)",
      );
      load();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const decide = async (action: "approve" | "reject") => {
    setWorking(true);
    try {
      await apiFetch(`/api/admin/locations/localities/${id}/${action}`, {
        method: "POST",
      });
      toast.success(action === "approve" ? "Locality approved" : "Request rejected");
      if (action === "reject") {
        router.push("/admin/locations");
        return;
      }
      load();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Action failed");
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64 rounded-md" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  if (error || !loc) {
    return (
      <div className="rounded-card border border-danger-100 bg-danger-50 p-4 text-danger-700">
        {error ?? "Locality not found."}
      </div>
    );
  }

  const introOk = introText.trim().length >= loc.introTextRequired;

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
          <h1 className="text-display-sm">{loc.name}</h1>
          <Badge tone={loc.status === "approved" ? "ink" : "warning"}>{loc.status}</Badge>
          {loc.isActive ? (
            <Badge tone="success">Live</Badge>
          ) : (
            <Badge tone="neutral">Not live</Badge>
          )}
          <span className="text-meta text-subtle-foreground">
            {loc.city?.name} · /{loc.slug}
          </span>
        </div>
        {loc.pincodes.length > 0 && (
          <p className="mt-1 text-meta text-muted-foreground">
            Pincodes: {loc.pincodes.join(", ")}
          </p>
        )}
      </div>

      {/* Pending request actions */}
      {loc.status === "pending" && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-warning-100 bg-warning-50 p-4">
          <p className="text-sm text-warning-700">
            This is a pending dealer request. Approving generates its slug (if missing)
            and marks it approved. It still needs 500+ chars of intro text and 3+ listings
            to go live.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => decide("approve")} disabled={working}>
              {working && <Loader2 className="animate-spin" />} Approve
            </Button>
            <Button variant="outline" onClick={() => decide("reject")} disabled={working}>
              Reject
            </Button>
          </div>
        </Card>
      )}

      {/* Live-status readout */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold text-ink-950">Live status (automatic)</h2>
        <p className="mt-0.5 text-meta text-muted-foreground">
          A locality goes live automatically when approved, its intro text is 500+ chars,
          and it has 3+ approved listings.
        </p>
        <div className="mt-3 max-w-md space-y-1.5 text-sm">
          <StatusRow ok={loc.status === "approved"} label="Status is approved" />
          <StatusRow
            ok={introOk}
            label={`Intro text ≥ ${loc.introTextRequired} chars (now ${introText.trim().length})`}
          />
          <StatusRow
            ok={loc.listingCount >= 3}
            label={`3+ approved listings (has ${loc.listingCount})`}
          />
        </div>
      </Card>

      {/* Content editor */}
      <Card className="p-5">
        <h2 className="mb-4 text-lg font-semibold text-ink-950">Content</h2>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="introText" required>
              Intro text{" "}
              <span
                className={`text-meta font-normal ${introOk ? "text-success-700" : "text-subtle-foreground"}`}
              >
                ({introText.trim().length} / {loc.introTextRequired} chars)
              </span>
            </Label>
            <Textarea
              id="introText"
              value={introText}
              onChange={(e) => setIntroText(e.target.value)}
              rows={6}
              invalid={introText.length > 0 && !introOk}
              placeholder="Describe the locality — connectivity, character, who it suits…"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="connectivity">Connectivity</Label>
            <Textarea
              id="connectivity"
              value={connectivity}
              onChange={(e) => setConnectivity(e.target.value)}
              rows={3}
              placeholder="Metro, highways, railway, airport distance…"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="metaTitle">Meta title</Label>
              <Input
                id="metaTitle"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="metaDescription">Meta description</Label>
              <Input
                id="metaDescription"
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
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

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <div className="flex items-center gap-2">
      <Icon className={ok ? "size-4 text-success-600" : "size-4 text-danger-500"} />
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
