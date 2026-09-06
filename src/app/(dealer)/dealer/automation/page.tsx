import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sparkles, MessageCircle, Bot, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";

import { getMyDealer } from "@/lib/dealers/account";
import { zenithOAuthConfigured, zenithConfigProblems } from "@/lib/zenith/oauth";
import { DealerShell } from "@/components/dealer/dealer-shell";
import { ZenithDisconnectButton } from "@/components/dealer/zenith-disconnect-button";
import { ZenithConnectButton } from "@/components/dealer/zenith-connect-button";
import { ZENITH_ERROR_MESSAGES } from "@/lib/zenith/errors";
import { Badge } from "@/components/ui/badge";
import { AutomationExplainer } from "@/components/dealer/automation-explainer";

export const metadata: Metadata = {
  title: "Automation",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function DealerAutomationPage({
  searchParams,
}: PageProps<"/dealer/automation">) {
  const dealer = await getMyDealer();
  if (!dealer) redirect("/dealer/login");
  if (!dealer.profileComplete) redirect("/dealer/onboarding");

  const sp = await searchParams;
  const errorCode = typeof sp.error === "string" ? sp.error : undefined;
  const connectedFlag = sp.connected === "1";
  const keys = typeof sp.keys === "string" ? sp.keys : undefined;
  const configured = zenithOAuthConfigured();
  const problems = configured ? [] : zenithConfigProblems();

  return (
    <DealerShell active="/dealer/automation">
      <div className="mb-8">
        <h1 className="text-display-sm">Automation</h1>
        <p className="mt-1 text-muted-foreground">
          Turn every enquiry into a WhatsApp conversation your AI agent handles for you.
        </p>
      </div>

      {connectedFlag && dealer.zenithConnected && (
        <div className="mb-5 flex items-center gap-2 rounded-card border border-success-100 bg-success-50 px-4 py-3 text-sm text-success-700">
          <CheckCircle2 className="size-4" /> Connected to Zenith Code. Your listings now show
          a WhatsApp button.
        </div>
      )}
      {errorCode && (
        <div className="mb-5 flex items-start gap-2 rounded-card border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p>{ZENITH_ERROR_MESSAGES[errorCode] ?? "Couldn't connect to Zenith Code."}</p>
            {(errorCode === "no_number" || errorCode === "no_org") && keys && (
              <p className="mt-1 text-meta">Dev hint — profile fields returned: {keys}.</p>
            )}
          </div>
        </div>
      )}

      <div
        id="zenith-connect"
        className="scroll-mt-28 rounded-card border border-border bg-surface p-6 shadow-card"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-clay-50 text-clay-700">
              <Sparkles className="size-6" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-ink-950">Connect with Zenith Code</h2>
              <p className="text-meta text-muted-foreground">
                WhatsApp AI sales agent for your leads
              </p>
            </div>
          </div>
          {dealer.zenithConnected ? (
            <Badge tone="success" size="sm">Connected</Badge>
          ) : (
            <Badge tone="neutral" size="sm">Not connected</Badge>
          )}
        </div>

        {dealer.zenithConnected ? (
          <>
            <div className="mt-5 grid gap-3 rounded-card border border-border bg-surface-muted p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-meta text-muted-foreground">Registered WhatsApp number</p>
                <p className="font-medium text-ink-950">+{dealer.zenithNumber}</p>
                <p className="text-meta text-muted-foreground">
                  Buyer enquiries go here — may differ from your contact number.
                </p>
              </div>
              <div>
                <p className="text-meta text-muted-foreground">Plan</p>
                <p className="font-medium text-ink-950">{dealer.zenithPlan ?? "—"}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Your listings show a <span className="font-medium text-ink-800">WhatsApp</span>{" "}
              button that routes buyers straight into your Zenith Code automation.
            </p>
            <div className="mt-5">
              <ZenithDisconnectButton />
            </div>
          </>
        ) : (
          <>
            <p className="mt-5 text-sm text-muted-foreground">
              Connect your Zenith-registered WhatsApp number. Once verified, your listings&apos;
              button switches from <span className="font-medium text-ink-800">Contact Us</span>{" "}
              to a <span className="font-medium text-ink-800">WhatsApp</span> button that routes
              buyers into your Zenith AI agent.
            </p>

            <ul className="mt-5 flex flex-col gap-2.5">
              <Step icon={MessageCircle} title="Authorize on Zenith Code" body="Sign in and approve NivaasBhoomi." />
              <Step icon={Bot} title="We link your WhatsApp number" body="We link the Zenith-registered WhatsApp number that will receive buyer enquiries — it may differ from your NivaasBhoomi contact number." />
              <Step icon={ArrowRight} title="Button switches to WhatsApp" body="Buyers reach your Zenith AI agent directly." />
            </ul>

            <div className="mt-6">
              {configured ? (
                <ZenithConnectButton />
              ) : (
                <div className="rounded-card border border-warning-100 bg-warning-50 px-4 py-3 text-meta text-warning-700">
                  Zenith Code isn&apos;t configured yet. Set: {problems.join(", ")}.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <p className="mt-4 text-meta text-muted-foreground">
        Zenith Code is a separate product. Connecting is optional — your leads keep flowing to
        this dashboard either way.
      </p>

      <AutomationExplainer connected={dealer.zenithConnected} />
    </DealerShell>
  );
}

function Step({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-ink-50 text-ink-700">
        <Icon className="size-4" />
      </span>
      <div>
        <p className="text-sm font-medium text-ink-950">{title}</p>
        <p className="text-meta text-muted-foreground">{body}</p>
      </div>
    </li>
  );
}
