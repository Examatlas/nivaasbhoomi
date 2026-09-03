import { BadgeCheck, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

/**
 * Verification badge derived from a dealer's verificationTier (DEV-SPEC.txt
 * Section 13). Trust is our core differentiator, so the tier is surfaced
 * plainly rather than hidden. Tier 0 shows nothing - an unverified dealer's
 * listing never goes live anyway, so there is no honest badge to display.
 */
const TIER_LABEL: Record<number, string> = {
  1: "Verified",
  2: "Verified Business",
  3: "RERA Verified",
  4: "Premium Verified",
};

export function VerificationBadge({
  tier,
  size = "md",
  className,
}: {
  tier: number;
  size?: "sm" | "md";
  className?: string;
}) {
  if (tier < 1) return null;

  const label = TIER_LABEL[tier] ?? "Verified";
  const Icon = tier >= 3 ? ShieldCheck : BadgeCheck;

  return (
    <Badge tone="verified" size={size} className={cn("shadow-subtle", className)}>
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  );
}
