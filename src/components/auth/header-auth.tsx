"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User as UserIcon, LogOut, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSession } from "@/components/auth/session-provider";
import { avatarInitial, formatSessionPhone } from "@/lib/auth/session-ui";

/**
 * Header auth control. Logged out → "Sign in". Logged in (buyer) → an orange
 * avatar with the name's first letter, opening a dropdown (name + phone, My
 * Profile, Logout). Client-side so it reflects login state on ISR/static pages
 * without a manual refresh. Works on mobile too.
 */
export function HeaderAuth() {
  const { me, loading, refresh } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function logout() {
    setOpen(false);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      /* clearing is best-effort */
    }
    await refresh();
    router.replace("/");
    router.refresh();
  }

  // Keep a stable-width slot during the initial load to avoid a flash/shift.
  if (loading) return <div className="size-9" aria-hidden />;

  if (!me?.authed) {
    return (
      <Button asChild variant="ghost" size="sm">
        <Link href="/login">Sign in</Link>
      </Button>
    );
  }

  const initial = avatarInitial(me.name, me.phone);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ink-600/30"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-clay-600 text-sm font-semibold text-white">
          {initial}
        </span>
        {me.name && (
          <span className="hidden max-w-[8rem] truncate text-sm font-medium text-ink-900 sm:inline">
            {me.name.split(" ")[0]}
          </span>
        )}
        <ChevronDown className="hidden size-4 text-muted-foreground sm:block" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-card border border-border bg-surface shadow-card"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink-950">{me.name || "Your account"}</p>
            {me.phone && <p className="text-meta text-muted-foreground">{formatSessionPhone(me.phone)}</p>}
          </div>
          <div className="flex flex-col py-1">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-ink-800 hover:bg-surface-muted"
              role="menuitem"
            >
              <UserIcon className="size-4 text-muted-foreground" /> My Profile
            </Link>
            {/* "My Enquiries" intentionally omitted — no buyer enquiries page exists yet. */}
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 text-left text-sm text-danger-700 hover:bg-surface-muted"
              role="menuitem"
            >
              <LogOut className="size-4" /> Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
