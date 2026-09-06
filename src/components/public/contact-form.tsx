"use client";

import { useState } from "react";
import { Loader2, Send, CheckCircle2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/lib/api/client";

/** Public contact form → POST /api/contact-us (Resend email + stored record). */
export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiFetch("/api/contact-us", {
        method: "POST",
        body: JSON.stringify({ name, email, phone, subject, message, website }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not send your message.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-success-100 bg-success-50 px-6 py-8 text-center">
        <CheckCircle2 className="size-10 text-success-600" />
        <p className="font-semibold text-ink-950">Message sent</p>
        <p className="text-sm text-muted-foreground">
          Thanks for reaching out — we&apos;ll get back to you by email soon.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {/* Honeypot: hidden from real users. */}
      <div className="hidden" aria-hidden>
        <label>
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
        </Field>
        <Field label="Email" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} required />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone (optional)">
          <Input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
        </Field>
        <Field label="Subject" required>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} required />
        </Field>
      </div>
      <Field label="Message" required>
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} maxLength={4000} required />
      </Field>

      {error && <p className="text-sm text-danger-700">{error}</p>}

      <Button type="submit" disabled={busy} size="lg" className="self-start">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Send message
      </Button>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label required={required}>{label}</Label>
      {children}
    </div>
  );
}
