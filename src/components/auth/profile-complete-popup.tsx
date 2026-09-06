"use client";

import { useEffect, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { useSession } from "@/components/auth/session-provider";
import { shouldPromptProfileCompletion } from "@/lib/auth/session-ui";

const DISMISS_KEY = "nb_profile_prompt_dismissed";

/**
 * Shown once, to a freshly-logged-in buyer whose name is missing. Asks for name
 * (required) and email (optional) — nothing else. "Skip for now" hides it for
 * the rest of the browser session (sessionStorage), and a saved name updates the
 * header instantly via the shared session refresh.
 */
export function ProfileCompletePopup() {
  const { me, loading, refresh } = useSession();
  const [dismissed, setDismissed] = useState(true); // assume dismissed until storage is read (no flash)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (loading || !shouldPromptProfileCompletion(me ?? null, dismissed)) return null;

  function skip() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode — fine, just closes for now */
    }
    setDismissed(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("Please enter your name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim(), email: email.trim() || undefined }),
      });
      try {
        sessionStorage.setItem(DISMISS_KEY, "1");
      } catch {
        /* ignore */
      }
      await refresh();
      setDismissed(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/50 p-4">
      <div className="w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-card">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-clay-50 text-clay-700">
            <UserPlus className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-ink-950">Complete your profile</h2>
            <p className="text-meta text-muted-foreground">
              So dealers know who is enquiring. Only your name is required.
            </p>
          </div>
        </div>

        <form onSubmit={save} className="mt-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pcp-name" required>
              Full name
            </Label>
            <Input
              id="pcp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              maxLength={120}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pcp-email">Email (optional)</Label>
            <Input
              id="pcp-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              maxLength={200}
            />
          </div>

          {error && <p className="text-meta text-danger-700">{error}</p>}

          <div className="mt-1 flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={skip} disabled={busy}>
              Skip for now
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
