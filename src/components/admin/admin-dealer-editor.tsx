"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, ShieldAlert } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import type { AdminDealerVerification } from "@/lib/dealers/admin";

const STATUSES = ["active", "paused", "banned"] as const;

/**
 * Admin force-edit panel (Phase 5). Edits the fields ONLY an admin can touch —
 * identity, account status, the slug (bypassing the dealer's 30-day lock), the
 * verified flag on each private verification document — plus tagline/about for
 * quick content moderation. The dealer's own full profile editor covers the rest;
 * this is the override, not a duplicate of it.
 */
export function AdminDealerEditor({ dealer }: { dealer: AdminDealerVerification }) {
  const router = useRouter();

  const [name, setName] = useState(dealer.name);
  const [businessName, setBusinessName] = useState(dealer.businessName);
  const [email, setEmail] = useState(dealer.email ?? "");
  const [status, setStatus] = useState(dealer.status);
  const [slug, setSlug] = useState(dealer.profile.slug ?? "");
  const [tagline, setTagline] = useState(dealer.profile.tagline ?? "");
  const [about, setAbout] = useState(dealer.profile.about ?? "");
  const [docVerified, setDocVerified] = useState<boolean[]>(
    dealer.verificationDocs.map((d) => d.verified),
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await apiFetch(`/api/admin/dealers/${dealer.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          businessName: businessName.trim(),
          email: email.trim(),
          status,
          slug: slug.trim(),
          tagline: tagline.trim(),
          about,
          docVerifications: docVerified.map((verified, index) => ({ index, verified })),
        }),
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="flex items-start gap-2 rounded-control border border-warning-100 bg-warning-50 px-3 py-2 text-meta text-warning-700">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        <span>
          Admin override. Changes here bypass the dealer&rsquo;s own restrictions, including the
          30-day link lock. About is still sanitized on save.
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name">
          <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} maxLength={160} />
        </Field>
        <Field label="Contact name">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </Field>
        <Field label="Account email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
        </Field>
        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 w-full rounded-control border border-border bg-surface px-3 text-sm text-ink-950"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Public link (slug)" hint="Overrides the 30-day change lock. The old link 301-redirects here.">
        <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} maxLength={80} placeholder="business-name-city" />
      </Field>

      <Field label="Tagline">
        <Input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={120} />
      </Field>
      <Field label="About" hint="Sanitized on save. Up to 2000 characters of text.">
        <Textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={5} />
      </Field>

      {dealer.verificationDocs.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label>Verification documents (private)</Label>
          <ul className="flex flex-col gap-1.5">
            {dealer.verificationDocs.map((d, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={docVerified[i] ?? false}
                    onCheckedChange={(c) =>
                      setDocVerified((cur) => cur.map((v, idx) => (idx === i ? Boolean(c) : v)))
                    }
                  />
                  <span className="font-medium text-ink-950">{d.type || `Document ${i + 1}`}</span>
                </label>
                {d.url && (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-meta text-clay-600 hover:underline"
                  >
                    View
                  </a>
                )}
                {d.uploadedAt && (
                  <span className="text-meta text-muted-foreground">
                    {new Date(d.uploadedAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="text-meta text-muted-foreground">
            These toggle the document&rsquo;s verified flag. Document-driven tier stays on the
            Documents panel.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-danger-700">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Save admin changes
        </Button>
        {saved && <span className="text-meta text-success-700">Saved.</span>}
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-meta text-muted-foreground">{hint}</p>}
    </div>
  );
}
