import type { Metadata } from "next";

import { getAutomationSettingsView } from "@/lib/settings/automation";
import { absoluteUrl } from "@/lib/seo/site";
import { AutomationSettingsForm } from "@/components/admin/automation-settings-form";

export const metadata: Metadata = { title: "Admin — Automation" };
export const dynamic = "force-dynamic";

export default async function AdminAutomationPage() {
  const view = await getAutomationSettingsView();

  return (
    <div className="mx-auto max-w-page px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-display-sm">Automation</h1>
        <p className="mt-1 text-muted-foreground">
          Connect Zenith Code as NivaasBhoomi&apos;s WhatsApp aggregator + AI qualification
          brain. Qualified leads are pushed to us and routed in our own DB.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-card border border-border bg-surface p-6">
          <AutomationSettingsForm initial={view} />
        </div>

        <aside className="flex flex-col gap-4">
          <section className="rounded-card border border-border bg-surface p-5 text-sm">
            <h2 className="mb-2 font-semibold text-ink-950">Lead push (inbound)</h2>
            <p className="text-muted-foreground">
              Point Zenith&apos;s lead webhook at:
            </p>
            <code className="mt-1 block break-all rounded-control bg-surface-muted px-2 py-1 text-meta">
              {absoluteUrl("/api/leads/ingest")}
            </code>
            <p className="mt-2 text-meta text-muted-foreground">
              Zenith must sign the body with the ingest secret — header{" "}
              <code>X-Zenith-Signature: sha256=&lt;hmac&gt;</code> (or{" "}
              <code>X-Ingest-Secret</code>). Include the buyer phone, the{" "}
              <code>[Ref: listingId]</code> from the CTA, the extracted fields, and{" "}
              <code>isQualified</code>.
            </p>
          </section>

          <section className="rounded-card border border-warning-100 bg-warning-50 p-5 text-meta text-warning-700">
            Outbound send via Zenith uses an <b>assumed</b> request shape (the Zenith send
            API couldn&apos;t be read). Confirm it against Zenith&apos;s docs before switching
            the provider to Zenith for production sends.
          </section>
        </aside>
      </div>
    </div>
  );
}
