"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X, Link2, Lock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/lib/api/client";

/**
 * Public-link (slug) editor with a live availability check, username-style. On
 * first login we surface this prominently so a dealer who landed on a numeric
 * suffix can pick a better link before it's shared or indexed. Locked for 30
 * days after the first manual change.
 */
export function DealerSlugEditor({
  dealerId,
  currentSlug,
  slugLockUntil,
  siteUrl,
}: {
  dealerId: string;
  currentSlug?: string;
  slugLockUntil?: string;
  siteUrl: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentSlug ?? "");
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [reason, setReason] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const timer = useRef<number | null>(null);

  const lockedUntil =
    slugLockUntil && new Date(slugLockUntil).getTime() > Date.now()
      ? new Date(slugLockUntil)
      : null;
  const unchanged = value === (currentSlug ?? "");

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    setSaved(false);
    if (unchanged || !value) {
      setStatus("idle");
      setReason(null);
      return;
    }
    setStatus("checking");
    timer.current = window.setTimeout(async () => {
      try {
        const res = await apiFetch<{ available: boolean; reason?: string }>(
          `/api/dealers/${dealerId}/slug/check?slug=${encodeURIComponent(value)}`,
        );
        setStatus(res.available ? "available" : "taken");
        setReason(res.reason ?? null);
      } catch {
        setStatus("idle");
      }
    }, 400);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [value, dealerId, unchanged]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/dealers/${dealerId}/slug`, {
        method: "PATCH",
        body: JSON.stringify({ slug: value }),
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not update your link.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-card border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-950">
        <Link2 className="size-4 text-clay-600" /> Your public profile link
      </h2>
      <p className="mt-1 text-meta text-muted-foreground">
        This is the link you can share on WhatsApp and Google. Pick something clean before you
        share it — you can change it once every 30 days.
      </p>

      <div className="mt-3 flex flex-col gap-1.5">
        <Label htmlFor="slug">Link</Label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-meta text-muted-foreground">{siteUrl}/agent/</span>
          <div className="relative flex-1 min-w-[12rem]">
            <Input
              id="slug"
              value={value}
              onChange={(e) => setValue(e.target.value.toLowerCase())}
              placeholder="your-business-name"
              disabled={Boolean(lockedUntil)}
            />
            <span className="absolute top-1/2 right-2 -translate-y-1/2">
              {status === "checking" && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              {status === "available" && <Check className="size-4 text-success-600" />}
              {status === "taken" && <X className="size-4 text-danger-600" />}
            </span>
          </div>
          <Button
            onClick={save}
            disabled={saving || unchanged || Boolean(lockedUntil) || status !== "available"}
            size="sm"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save link
          </Button>
        </div>
        {status === "taken" && reason && <p className="text-meta text-danger-700">{reason}</p>}
        {status === "available" && (
          <p className="text-meta text-success-700">Available — save to claim it.</p>
        )}
        {error && <p className="text-meta text-danger-700">{error}</p>}
        {saved && <p className="text-meta text-success-700">Saved. Your old link now redirects here.</p>}
        {lockedUntil && (
          <p className="inline-flex items-center gap-1 text-meta text-warning-700">
            <Lock className="size-3.5" /> Locked until{" "}
            {lockedUntil.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.
          </p>
        )}
      </div>
    </section>
  );
}
