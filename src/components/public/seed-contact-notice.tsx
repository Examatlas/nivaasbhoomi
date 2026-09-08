import { ShieldQuestion } from "lucide-react";

import { SaveAlertButton } from "@/components/alerts/save-alert-button";

/**
 * Shown in place of the contact button on a SEED (display-only) listing — no
 * contact, no phone, no enquiry. A neutral status line + a soft CTA to set a
 * WhatsApp alert for new (real) properties in the area (Phase 3 saved-search).
 */
export function SeedContactNotice({
  cityId,
  localityId,
  purpose,
}: {
  cityId: string;
  localityId: string;
  purpose: "sale" | "rent";
}) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-muted/60 p-4">
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <ShieldQuestion className="mt-0.5 size-4 shrink-0 text-clay-600" />
        This property is still in verification.
      </p>
      <SaveAlertButton
        criteria={{
          cityId,
          localityIds: localityId ? [localityId] : [],
          purpose: purpose === "rent" ? "rent" : "buy",
        }}
        label="Get alerts for new properties here"
      />
    </div>
  );
}
