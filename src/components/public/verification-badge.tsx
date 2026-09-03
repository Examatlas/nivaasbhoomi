import { BadgeCheck, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

/**
 * Verification badge derived from a dealer's verificationTier (DEV-SPEC.txt
 * Section 13). Trust is our core differentiator, so the tier is surfaced
 * plainly rather than hidden. Tier 0 shows nothing - an unverified dealer's
 * listing never goes live anyway, so there is no honest badge to display.
 *
 * Contrast: every tier is legible at WCAG AA or better. Tiers 1-2 are soft
 * green *tints* with dark green text; tiers 3-4 are solid fills with white text
 * (green for RERA, clay/gold for Premium) so higher trust reads as more
 * emphatic while every label stays readable. None of these is the saturated
 * WhatsApp green, so the verify signal never masquerades as the CTA.
 */
const TIER_LABEL: Record<number, string> = {
  1: "Verified",
  2: "Verified Business",
  3: "RERA Verified",
  4: "Premium Verified",
};

// Per-tier colour overrides layered over the Badge `verified` tone (which is
// the tier-1 soft green tint). twMerge lets these win over the tone defaults.
const TIER_STYLE: Record<number, string> = {
  1: "", // uses the base `verified` tone (soft green tint, dark green text)
  2: "border-success-500/30 bg-success-100 text-success-700",
  3: "border-success-700 bg-success-700 text-white",
  4: "border-clay-800 bg-clay-800 text-white",
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
  const tierStyle = TIER_STYLE[tier] ?? TIER_STYLE[1];

  return (
    <Badge
      tone="verified"
      size={size}
      className={cn("shadow-subtle", tierStyle, className)}
    >
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  );
}
