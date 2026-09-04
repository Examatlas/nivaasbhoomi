"use client";

import { useState } from "react";
import { MessageSquare, Loader2, CheckCircle2, Phone } from "lucide-react";

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button, type ButtonProps } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/lib/api/client";

/**
 * On-site enquiry form (launch flow, no WhatsApp). Opens a dialog that captures
 * name + phone + optional message and posts to /api/enquiries, which saves the
 * lead (with the listing Ref) and routes it to the dealer. The dealer then
 * contacts the buyer directly.
 */
export function EnquiryForm({
  listingId,
  listingTitle,
  triggerLabel = "Enquire now",
  block,
  size = "lg",
}: {
  listingId?: string;
  listingTitle?: string;
  triggerLabel?: string;
  block?: boolean;
  size?: ButtonProps["size"];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(
    listingTitle ? `I'm interested in: ${listingTitle}` : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/enquiries", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          message: message.trim() || undefined,
          ...(listingId ? { listingId } : {}),
        }),
      });
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          // reset after close so a reopen is fresh
          setTimeout(() => {
            setDone(false);
            setError(null);
          }, 200);
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
        {done ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="size-12 text-success-600" />
            <DialogTitle>Enquiry sent</DialogTitle>
            <DialogDescription>
              Thanks{name ? `, ${name.split(" ")[0]}` : ""}! The dealer has your details and
              will contact you shortly. No spam — just a direct call or message.
            </DialogDescription>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Enquire about this property</DialogTitle>
              <DialogDescription>
                Leave your details and the verified dealer will reach out. We never share
                your number publicly.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="mt-2 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="enq-name" required>
                  Your name
                </Label>
                <Input
                  id="enq-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="enq-phone" required>
                  Mobile number
                </Label>
                <div className="relative">
                  <Phone className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="enq-phone"
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile"
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="enq-msg">Message (optional)</Label>
                <Textarea
                  id="enq-msg"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                />
              </div>
              {error && <p className="text-sm text-danger-700">{error}</p>}
              <Button type="submit" disabled={busy} block size="lg">
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Send enquiry
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
