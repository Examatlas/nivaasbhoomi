"use client";

import { useState } from "react";
import { LogOut, Loader2 } from "lucide-react";

import { hardNavigate, fetchWithTimeout } from "@/lib/auth/auth-nav";

export function StaffSignOutButton() {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetchWithTimeout("/api/auth/logout", { method: "POST" });
    } catch {
      /* clearing the cookie is best-effort; navigate regardless */
    }
    hardNavigate("/staff/login");
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-control px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
      Sign out
    </button>
  );
}
