"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Check, X, Loader2 } from "lucide-react";

import { apiFetch } from "@/lib/api/client";

interface LastNotification {
  event: string;
  delivered: boolean;
  error?: string | null;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/**
 * Small "was the dealer notified on WhatsApp?" indicator, backed by
 * WhatsAppSendLog. Pass `entityId` (a listingId or dealerId) and bump
 * `refreshKey` after an approve/reject/verify action to re-read the latest row.
 */
export function NotificationStatus({
  entityId,
  refreshKey = 0,
}: {
  entityId: string;
  refreshKey?: number;
}) {
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "none" } | { kind: "loaded"; n: LastNotification }
  >({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ kind: "loading" });
    apiFetch<{ notification: LastNotification | null }>(
      `/api/admin/notifications/status?entityId=${encodeURIComponent(entityId)}`,
    )
      .then((r) => {
        if (!alive) return;
        setState(r.notification ? { kind: "loaded", n: r.notification } : { kind: "none" });
      })
      .catch(() => alive && setState({ kind: "none" }));
    return () => {
      alive = false;
    };
  }, [entityId, refreshKey]);

  const base =
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-meta font-medium";

  if (state.kind === "loading") {
    return (
      <span className={`${base} bg-ink-50 text-muted-foreground`}>
        <Loader2 className="size-3 animate-spin" /> WhatsApp…
      </span>
    );
  }
  if (state.kind === "none") {
    return (
      <span className={`${base} bg-ink-50 text-muted-foreground`}>
        <MessageCircle className="size-3" /> No WhatsApp sent
      </span>
    );
  }

  const { n } = state;
  return n.delivered ? (
    <span
      className={`${base} bg-success-50 text-success-700`}
      title={`Sent ${new Date(n.createdAt).toLocaleString("en-IN")}`}
    >
      <Check className="size-3" /> WhatsApp sent · {timeAgo(n.createdAt)}
    </span>
  ) : (
    <span
      className={`${base} bg-danger-50 text-danger-700`}
      title={n.error ?? "Send failed"}
    >
      <X className="size-3" /> WhatsApp failed · {timeAgo(n.createdAt)}
    </span>
  );
}
