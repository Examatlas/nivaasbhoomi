"use client";

import { useState } from "react";
import { Star, Loader2, CheckCircle2 } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/lib/api/client";

/**
 * Buyer review form (DEV-SPEC.txt Section 13). Submits to the public review
 * endpoint, which enforces eligibility (site-visit-done, one per lead).
 */
export function ReviewForm({ leadId, dealerName }: { leadId: string; dealerName: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    if (rating < 1) {
      setError("Please tap a star to rate.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/reviews/${leadId}`, {
        method: "POST",
        body: JSON.stringify({ rating, comment }),
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not submit. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle2 className="size-12 text-success-600" />
        <p className="text-lg font-semibold text-ink-950">Thank you!</p>
        <p className="text-sm text-muted-foreground">
          Your review of {dealerName} has been recorded.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              className="p-1"
            >
              <Star
                className={
                  "size-9 transition-colors " +
                  ((hover || rating) >= n
                    ? "fill-clay-400 text-clay-400"
                    : "fill-transparent text-sand-300")
                }
              />
            </button>
          ))}
        </div>
        {rating > 0 && (
          <p className="text-meta text-muted-foreground">
            {["", "Poor", "Fair", "Good", "Very good", "Excellent"][rating]}
          </p>
        )}
      </div>

      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Tell others about your experience (optional)"
        rows={4}
      />

      {error && <p className="text-sm text-danger-700">{error}</p>}

      <Button onClick={submit} disabled={busy} block size="lg">
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        Submit review
      </Button>
    </div>
  );
}
