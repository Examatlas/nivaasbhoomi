import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sparkles, MessageCircle, Bot, ArrowRight, Lock } from "lucide-react";

import { getMyDealer } from "@/lib/dealers/account";
import { DealerShell } from "@/components/dealer/dealer-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Automation",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Dealer → Automation. PLACEHOLDER for launch. "Connect with Zenith Code" is
 * scaffolded but not functional: the real flow (verify the dealer's WhatsApp
 * number is registered on Zenith Code via its API, then switch this dealer's
 * property button from "Contact Us" to a WhatsApp button routing buyers into
 * their Zenith automation) is a later phase. Nothing here writes any state.
 */
export default async function DealerAutomationPage() {
  const dealer = await getMyDealer();
  if (!dealer) redirect("/dealer/login");
  if (!dealer.profileComplete) redirect("/dealer/onboarding");

  return (
    <DealerShell active="/dealer/automation">
      <div className="mb-8">
        <h1 className="text-display-sm">Automation</h1>
        <p className="mt-1 text-muted-foreground">
          Turn every enquiry into a WhatsApp conversation your AI agent handles for you.
        </p>
      </div>

      {/* Connect with Zenith Code — coming soon */}
      <div className="rounded-card border border-border bg-surface p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-clay-50 text-clay-700">
              <Sparkles className="size-6" />
            </span>
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-950">
                Connect with Zenith Code
              </h2>
              <p className="text-meta text-muted-foreground">
                WhatsApp AI sales agent for your leads
              </p>
            </div>
          </div>
          <Badge tone="warning" size="sm">
            Coming soon
          </Badge>
        </div>

        <p className="mt-5 text-sm text-muted-foreground">
          Today, buyers tap <span className="font-medium text-ink-800">Contact Us</span> on
          your listings and their details arrive in your{" "}
          <span className="font-medium text-ink-800">Leads</span>. Soon, you&apos;ll be able
          to connect a WhatsApp number that&apos;s registered on Zenith Code — and your
          listings&apos; button becomes a <span className="font-medium text-ink-800">
            WhatsApp
          </span>{" "}
          button that routes each buyer straight into your Zenith AI agent to qualify them
          for you, 24×7.
        </p>

        <ul className="mt-5 flex flex-col gap-2.5">
          <Step
            icon={MessageCircle}
            title="Register your number on Zenith Code"
            body="Your WhatsApp Business number must be active on Zenith Code (not AiSensy, Interakt or Wati)."
          />
          <Step
            icon={Bot}
            title="Verify & connect here"
            body="We'll confirm the number is Zenith-registered, then link it to your account."
          />
          <Step
            icon={ArrowRight}
            title="Your button switches to WhatsApp"
            body="Buyers reach your Zenith AI agent directly — it qualifies and books site visits automatically."
          />
        </ul>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button disabled aria-disabled className="cursor-not-allowed opacity-60">
            <Lock className="size-4" />
            Connect with Zenith Code
          </Button>
          <span className="text-meta text-muted-foreground">
            Not available yet — we&apos;ll notify you when it goes live.
          </span>
        </div>
      </div>

      <p className="mt-4 text-meta text-muted-foreground">
        Zenith Code is a separate product. Connecting it will be optional — your leads keep
        flowing to this dashboard either way.
      </p>
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
