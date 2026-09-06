"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, ShieldCheck, LogOut } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { useSession } from "@/components/auth/session-provider";
import { formatSessionPhone } from "@/lib/auth/session-ui";

/** Buyer profile: editable name + optional email, read-only verified phone,
 *  and logout. Phone is the login identity, so it is never editable here. */
export function BuyerProfileForm({
  initial,
}: {
  initial: { name: string; email: string; phone: string };
}) {
  const router = useRouter();
  const { refresh } = useSession();
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (name.trim().length < 2) {
      setError("Please enter your name.");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      setSaved(true);
      await refresh();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      /* best-effort */
    }
    await refresh();
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="mt-6 flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pf-name" required>
          Full name
        </Label>
        <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pf-email">Email (optional)</Label>
        <Input
          id="pf-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          maxLength={200}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Phone</Label>
        <div className="flex items-center gap-2">
          <Input value={formatSessionPhone(initial.phone)} disabled className="flex-1" />
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-meta font-medium text-success-700">
            <ShieldCheck className="size-3.5" /> Verified
          </span>
        </div>
        <p className="text-meta text-muted-foreground">
          This is your login number and cannot be changed here.
        </p>
      </div>

      {error && <p className="text-sm text-danger-700">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Save changes
        </Button>
        {saved && <span className="text-meta text-success-700">Saved.</span>}
        <Button type="button" variant="ghost" onClick={logout} className="ml-auto text-danger-700">
          <LogOut className="size-4" /> Logout
        </Button>
      </div>
    </form>
  );
}
