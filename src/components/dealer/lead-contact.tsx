"use client";

import { useState } from "react";
import { Phone, Eye, Loader2, MessageCircle, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api/client";

/**
 * Buyer phone is hidden behind "View details". The first reveal records viewedAt
 * server-side (stops the SLA clock). whatsapp_click leads show the phone straight
 * away — the buyer already reached out on the dealer's WhatsApp.
 */
export function LeadContact({
  leadId,
  phone,
  viewed,
  source,
  slaDeadline,
}: {
  leadId: string;
  phone: string | null;
  viewed: boolean;
  source: string;
  slaDeadline?: string;
}) {
  const [revealed, setRevealed] = useState<string | null>(phone);
  const [busy, setBusy] = useState(false);
  const isWhatsApp = source === "whatsapp_click";

  async function reveal() {
    setBusy(true);
    try {
      const res = await apiFetch<{ phone: string }>(`/api/dealers/leads/${leadId}/view`, {
        method: "POST",
      });
      setRevealed(res.phone);
    } catch {
      /* stays hidden; dealer can retry */
    } finally {
      setBusy(false);
    }
  }

  if (revealed) {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <a
          href={`tel:+${revealed}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-wa-700 hover:underline"
        >
          <Phone className="size-4" /> +{revealed}
        </a>
        {isWhatsApp ? (
          <Badge tone="success" size="sm">
            <MessageCircle className="size-3" /> WhatsApp
          </Badge>
        ) : viewed ? (
          <span className="text-meta text-muted-foreground">Viewed</span>
        ) : null}
      </div>
    );
  }

  const minsLeft = slaDeadline
    ? Math.max(0, Math.round((new Date(slaDeadline).getTime() - Date.now()) / 60000))
    : null;

  return (
    <div className="mt-1 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={reveal} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
          View details
        </Button>
        <Badge tone="neutral" size="sm">
          Not viewed
        </Badge>
      </div>
      {minsLeft != null && minsLeft > 0 && (
        <p className="inline-flex items-center gap-1 text-meta text-warning-700">
          <Clock className="size-3.5" /> Moves to another dealer in ~{minsLeft} min if not viewed.
        </p>
      )}
    </div>
  );
}
