"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Phone, ShieldAlert, Clock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import type { MyDealer } from "@/lib/dealers/account";

/**
 * Dealer-managed login credentials (email + phone). Email changes go through a
 * verify-the-new-address flow (never written directly); phone changes are
 * allowed but flagged unverified until WhatsApp OTP is available.
 */
export function AccountDetailsForm({ dealer }: { dealer: MyDealer }) {
  const router = useRouter();

  // ---- Email ----
  const [email, setEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<string | null>(null);

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setEmailSent(null);
    setEmailBusy(true);
    try {
      await apiFetch(`/api/dealers/${dealer.id}/email`, {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setEmailSent(email.trim());
      setEmail("");
      router.refresh();
    } catch (err) {
      setEmailError(err instanceof ApiClientError ? err.message : "Could not send the link.");
    } finally {
      setEmailBusy(false);
    }
  }

  // ---- Phone ----
  const [phone, setPhone] = useState(dealer.phone);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSaved, setPhoneSaved] = useState(false);

  async function submitPhone(e: React.FormEvent) {
    e.preventDefault();
    setPhoneError(null);
    setPhoneSaved(false);
    setPhoneBusy(true);
    try {
      await apiFetch(`/api/dealers/${dealer.id}/phone`, {
        method: "POST",
        body: JSON.stringify({ phone: phone.trim() }),
      });
      setPhoneSaved(true);
      router.refresh();
    } catch (err) {
      setPhoneError(err instanceof ApiClientError ? err.message : "Could not update your number.");
    } finally {
      setPhoneBusy(false);
    }
  }

  return (
    <section className="rounded-card border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold text-ink-950">Account details</h2>
      <p className="mt-1 text-meta text-muted-foreground">
        Your login email and phone number. Changing your email needs confirmation on the new
        address.
      </p>

      {/* Email */}
      <form onSubmit={submitEmail} className="mt-5 flex flex-col gap-2">
        <Label htmlFor="acct-email" className="flex items-center gap-1.5">
          <Mail className="size-4 text-clay-600" /> Account email
        </Label>
        <p className="text-meta text-muted-foreground">
          {dealer.email ? (
            <>Current: <span className="font-medium text-ink-800">{dealer.email}</span></>
          ) : (
            "No email set yet — add one to enable email/password sign-in and password reset."
          )}
        </p>
        {dealer.pendingEmail && (
          <p className="inline-flex items-center gap-1.5 rounded-control border border-warning-100 bg-warning-50 px-3 py-2 text-meta text-warning-700">
            <Clock className="size-4 shrink-0" /> Pending verification:{" "}
            <span className="font-medium">{dealer.pendingEmail}</span> — check that inbox and click
            the confirmation link.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="acct-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={dealer.email ? "New email address" : "you@example.com"}
            className="flex-1 min-w-[14rem]"
          />
          <Button type="submit" disabled={emailBusy || !email.trim()}>
            {emailBusy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            Send verification link
          </Button>
        </div>
        {emailError && <p className="text-meta text-danger-700">{emailError}</p>}
        {emailSent && (
          <p className="text-meta text-success-700">
            Verification link sent to {emailSent}. Click it to confirm — your email changes only
            after that.
          </p>
        )}
      </form>

      <hr className="my-6 border-border" />

      {/* Phone */}
      <form onSubmit={submitPhone} className="flex flex-col gap-2">
        <Label htmlFor="acct-phone" className="flex items-center gap-1.5">
          <Phone className="size-4 text-clay-600" /> Phone number
        </Label>
        <p className="text-meta text-muted-foreground">
          Your WhatsApp / sign-in number.{" "}
          {dealer.phoneVerified ? (
            <span className="text-success-700">Verified.</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-warning-700">
              <ShieldAlert className="size-3.5" /> Unverified.
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="acct-phone"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="91XXXXXXXXXX"
            className="flex-1 min-w-[14rem]"
          />
          <Button type="submit" variant="outline" disabled={phoneBusy || !phone.trim()}>
            {phoneBusy ? <Loader2 className="size-4 animate-spin" /> : <Phone className="size-4" />}
            Update phone
          </Button>
        </div>
        <p className="text-meta text-muted-foreground">
          Number verification over WhatsApp is coming soon — for now a changed number is marked
          unverified.
        </p>
        {phoneError && <p className="text-meta text-danger-700">{phoneError}</p>}
        {phoneSaved && <p className="text-meta text-success-700">Phone number updated.</p>}
      </form>
    </section>
  );
}
