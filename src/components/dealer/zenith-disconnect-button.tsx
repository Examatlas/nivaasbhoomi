"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Unplug } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Disconnects the dealer's Zenith Code connection, then refreshes the page. */
export function ZenithDisconnectButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function disconnect() {
    if (busy) return;
    if (!confirm("Disconnect Zenith Code? Your listings' button will switch back to “Contact Us”.")) {
      return;
    }
    setBusy(true);
    try {
      await fetch("/api/auth/zenith/disconnect", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" onClick={disconnect} disabled={busy}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4" />}
      Disconnect
    </Button>
  );
}
