"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  Loader2,
  CheckCircle2,
  LogIn,
  ShieldCheck,
} from "lucide-react";

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { ContactMode } from "@/lib/leads/contact-mode";

/**
 * The single call-to-action on a listing. GATED: only a signed-in buyer can
 * send a contact request. It has two modes so we can switch behaviour per dealer
 * without changing the pages (see lib/leads/contact-mode):
 *
 *   mode "contact"  (default, everyone at launch)
 *     Tap → if signed out, prompt sign-in (?next back to this page); if signed
 *     in, POST /api/contact to create a lead that lands in the dealer's
 *     dashboard. The dealer then contacts the buyer.
 *
 *   mode "whatsapp" (future, when the dealer is Zenith-connected)
 *     Renders a WhatsApp button linking straight to the dealer's Zenith
 *     automation. Dormant now — no dealer is Zenith-connected.
 *
 * The page is static/ISR, so auth is resolved on the client: we check
 * /api/auth/me when the dialog opens, and defensively treat a 401 on submit as
 * "please sign in".
 */
type AuthState = "unknown" | "authed" | "guest";

export function PropertyContactButton({
  listingId,
  listingTitle,
  dealerName,
  mode = "contact",
  whatsappNumber,
  listingSlug,
  profileSlug,
  dealerId,
  triggerLabel = "Contact Us",
  block,
  size = "lg",
}: {
  /** Required for the listing "contact" enquiry. Omitted for a dealer-profile
   *  contact, which uses dealerId instead. */
  listingId?: string;
  listingTitle?: string;
  dealerName?: string;
  mode?: ContactMode;
  whatsappNumber?: string;
  listingSlug?: string;
  /** Dealer id — a direct-to-dealer enquiry from the /agent profile. */
  dealerId?: string;
  /** Dealer profile slug — used to build the WhatsApp message on the dealer page
   *  where there's no listing context. */
  profileSlug?: string;
  triggerLabel?: string;
  block?: boolean;
  size?: ButtonProps["size"];
}) {
  // WhatsApp mode (Zenith-connected dealer). The URL is built HERE, on the
  // client, from window.location.origin — so it always uses the real live domain
  // and can never carry a build-time-baked localhost. Works for a listing
  // (property URL + [Ref]) OR a dealer profile (profile URL).
  if (mode === "whatsapp" && whatsappNumber) {
    const openWhatsApp = async () => {
      // Pre-open a tab synchronously (in the click gesture) so the popup blocker
      // doesn't kill it after the await; we set its URL once the server responds.
      const win = window.open("", "_blank");
      try {
        const res = await fetch("/api/leads/whatsapp-click", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(listingId ? { listingId } : { dealerId }),
        });
        if (res.status === 401) {
          win?.close();
          const next = window.location.pathname + window.location.search;
          window.location.href = `/login?next=${encodeURIComponent(next)}`;
          return;
        }
        const json = (await res.json()) as { data?: { waUrl?: string } };
        const waUrl = json?.data?.waUrl;
        if (waUrl && win) win.location.href = waUrl;
        else if (waUrl) window.open(waUrl, "_blank", "noopener,noreferrer");
        else win?.close();
      } catch {
        win?.close();
      }
    };
    return (
      <Button
        block={block}
        size={size}
        className="bg-wa-600 text-white hover:bg-wa-700"
        onClick={openWhatsApp}
      >
        <MessageSquare className="size-4" />
        WhatsApp
      </Button>
    );
  }

  // "contact" mode: a listing enquiry (listingId) or a direct dealer enquiry
  // from the /agent profile (dealerId).
  return (
    <ContactDialog
      {...{ listingId: listingId ?? "", dealerId, listingTitle, dealerName, triggerLabel, block, size }}
    />
  );
}

function ContactDialog({
  listingId,
  dealerId,
  listingTitle,
  dealerName,
  triggerLabel,
  block,
  size,
}: {
  listingId: string;
  dealerId?: string;
  listingTitle?: string;
  dealerName?: string;
  triggerLabel: string;
  block?: boolean;
  size?: ButtonProps["size"];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [auth, setAuth] = useState<AuthState>("unknown");
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const loginHref = `/login?next=${encodeURIComponent(pathname ?? "/")}`;

  async function checkAuth() {
    setAuth("unknown");
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const body = await res.json();
      if (res.ok && body?.success && body.data?.authed) {
        setAuth("authed");
        setName(body.data.name ?? null);
      } else {
        setAuth("guest");
      }
    } catch {
      setAuth("guest");
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dealerId ? { dealerId } : { listingId }),
      });
      const body = await res.json();
      if (res.status === 401) {
        setAuth("guest");
        return;
      }
      if (!res.ok || !body?.success) {
        setError(body?.error?.message ?? "Something went wrong. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setDone(false);
          setError(null);
          void checkAuth();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button block={block} size={size}>
          <MessageSquare className="size-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        {auth === "unknown" ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
            <DialogDescription>Checking your sign-in…</DialogDescription>
          </div>
        ) : done ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="size-12 text-success-600" />
            <DialogTitle>Request sent</DialogTitle>
            <DialogDescription>
              {dealerName ? `${dealerName} has` : "The dealer has"} your details and will
              contact you shortly. No spam — just a direct call or message.
            </DialogDescription>
          </div>
        ) : auth === "guest" ? (
          <>
            <DialogHeader>
              <DialogTitle>Sign in to contact the dealer</DialogTitle>
              <DialogDescription>
                Verify your number once on WhatsApp, then contact any dealer with a single
                tap. We never share your number publicly.
              </DialogDescription>
            </DialogHeader>
            <Button asChild block size="lg" className="mt-2">
              <Link href={loginHref}>
                <LogIn className="size-4" />
                Sign in with WhatsApp
              </Link>
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Contact {dealerName ?? "the dealer"}</DialogTitle>
              <DialogDescription>
                {name ? `Hi ${name.split(" ")[0]} — we` : "We"}&apos;ll share your name and
                number{listingTitle ? ` about “${listingTitle}”` : ""} so the verified dealer
                can reach you directly.
              </DialogDescription>
            </DialogHeader>
            <p className="mt-1 inline-flex items-center gap-1.5 text-meta text-muted-foreground">
              <ShieldCheck className="size-4 text-success-600" />
              Your number is never shown on the public site.
            </p>
            {error && <p className="mt-1 text-sm text-danger-700">{error}</p>}
            <Button onClick={submit} disabled={busy} block size="lg" className="mt-2">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <MessageSquare className="size-4" />}
              Send my details
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
