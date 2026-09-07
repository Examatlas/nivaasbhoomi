import { permanentRedirect } from "next/navigation";

/**
 * The stamp-duty tool moved to /tools/stamp-duty (state-wise pages + lead
 * magnet). Permanent-redirect the old URL so links and any indexed page follow
 * to the new one — no duplicate content.
 */
export default function LegacyStampDutyCalculatorPage() {
  permanentRedirect("/tools/stamp-duty");
}
