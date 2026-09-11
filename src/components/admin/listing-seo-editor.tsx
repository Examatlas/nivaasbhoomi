"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, History } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { NotificationStatus } from "@/components/admin/notification-status";
import { apiFetch, ApiClientError } from "@/lib/api/client";

interface Detail {
  title: string;
  description: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  slug?: string | null;
}
interface HistoryEntry {
  at: string;
  by: string;
  actorType: string;
  changes: Record<string, { from: string; to: string }>;
}

const FIELD_LABEL: Record<string, string> = {
  title: "Title",
  description: "Description",
  metaTitle: "Meta title",
  metaDescription: "Meta description",
  slug: "URL",
};

/** Char-count hint with a gentle target range for SEO fields. */
function Counter({ n, lo, hi }: { n: number; lo: number; hi: number }) {
  const tone = n === 0 ? "text-muted-foreground" : n < lo || n > hi ? "text-warning-700" : "text-success-700";
  return <span className={`text-overline ${tone}`}>{n} chars (aim {lo}–{hi})</span>;
}

/**
 * Admin SEO & content editor for a listing. Dealers often leave these weak;
 * admins fix title/description/meta/slug here. A slug change 301-redirects the
 * old URL, is audited, and notifies the dealer. Shows the edit history.
 */
export function ListingSeoEditor({ id }: { id: string }) {
  const [d, setD] = useState<Detail | null>(null);
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [notifKey, setNotifKey] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const loadHistory = () =>
    apiFetch<HistoryEntry[]>(`/api/admin/listings/${id}/history`).then(setHistory).catch(() => {});

  useEffect(() => {
    apiFetch<Detail>(`/api/admin/listings/${id}`)
      .then((l) => {
        setD({
          title: l.title ?? "",
          description: l.description ?? "",
          metaTitle: l.metaTitle ?? "",
          metaDescription: l.metaDescription ?? "",
          slug: l.slug ?? "",
        });
        setSlug(l.slug ?? "");
      })
      .catch((e) => setErr(e instanceof ApiClientError ? e.message : "Failed to load."));
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const set = (k: keyof Detail, v: string) => setD((prev) => (prev ? { ...prev, [k]: v } : prev));

  async function save() {
    if (!d) return;
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, string> = {
        title: d.title,
        description: d.description,
        metaTitle: d.metaTitle ?? "",
        metaDescription: d.metaDescription ?? "",
      };
      if (slug.trim() && slug.trim() !== (d.slug ?? "")) body.slug = slug.trim();
      const res = await apiFetch<{ slug: string | null; changed: string[] }>(
        `/api/admin/listings/${id}`,
        { method: "PATCH", body: JSON.stringify(body) },
      );
      if (res.changed.length === 0) {
        toast("No changes to save.");
      } else {
        toast.success(`Saved: ${res.changed.map((f) => FIELD_LABEL[f] ?? f).join(", ")}.`);
        if (res.slug) {
          setSlug(res.slug);
          setD((prev) => (prev ? { ...prev, slug: res.slug } : prev));
        }
        loadHistory();
        setNotifKey((k) => k + 1);
        setTimeout(() => setNotifKey((k) => k + 1), 3000);
      }
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  if (!d) {
    return (
      <Card className="mt-6 p-5 text-sm text-muted-foreground">
        {err ?? "Loading SEO editor…"}
      </Card>
    );
  }

  return (
    <Card className="mt-6 flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-ink-950">SEO &amp; content</h2>
        <NotificationStatus entityId={id} refreshKey={notifKey} />
      </div>
      <p className="text-meta text-muted-foreground">
        Editing these updates the live page and notifies the dealer. Changing the URL keeps
        the old one working (301 redirect).
      </p>

      <div className="flex flex-col gap-1.5">
        <Label>Title</Label>
        <Input value={d.title} onChange={(e) => set("title", e.target.value)} maxLength={160} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Description</Label>
        <Textarea value={d.description} onChange={(e) => set("description", e.target.value)} rows={5} />
        <Counter n={d.description.length} lo={100} hi={2000} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Meta title</Label>
          <Input value={d.metaTitle ?? ""} onChange={(e) => set("metaTitle", e.target.value)} maxLength={200} placeholder="Falls back to the title" />
          <Counter n={(d.metaTitle ?? "").length} lo={50} hi={60} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>URL slug</Label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="my-listing-slug" />
          <span className="text-overline text-muted-foreground">/property/{slug || "…"}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Meta description</Label>
        <Textarea value={d.metaDescription ?? ""} onChange={(e) => set("metaDescription", e.target.value)} rows={2} maxLength={400} placeholder="Falls back to the description" />
        <Counter n={(d.metaDescription ?? "").length} lo={150} hi={160} />
      </div>

      {err && <p className="text-meta text-danger-700">{err}</p>}

      <div>
        <Button onClick={save} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save changes
        </Button>
      </div>

      {/* Edit history */}
      <div className="mt-2 border-t border-border pt-3">
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-950">
          <History className="size-4 text-muted-foreground" /> Edit history
        </h3>
        {history.length === 0 ? (
          <p className="text-meta text-muted-foreground">No edits yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((h, i) => (
              <li key={i} className="rounded-control border border-border bg-surface-muted/40 p-2.5 text-meta">
                <div className="text-muted-foreground">
                  {new Date(h.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {h.by}
                </div>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {Object.entries(h.changes).map(([f, c]) => (
                    <li key={f} className="text-ink-800">
                      <span className="font-medium">{FIELD_LABEL[f] ?? f}:</span>{" "}
                      <span className="text-danger-700 line-through">{c.from || "∅"}</span> →{" "}
                      <span className="text-success-700">{c.to || "∅"}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
