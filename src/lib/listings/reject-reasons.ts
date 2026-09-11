/**
 * Structured listing-rejection reasons (Part 2). ONE source of truth for the
 * admin reject dialog's checkboxes and the reason-string builder — never
 * hardcoded per screen.
 */
export const REJECT_REASONS = [
  { value: "unclear_photos", label: "Photos are unclear or low quality" },
  { value: "photos_mismatch", label: "Photos do not match the property" },
  { value: "not_enough_photos", label: "Not enough photos" },
  { value: "price_incorrect", label: "Price looks incorrect" },
  { value: "location_wrong", label: "Location details are wrong" },
  { value: "description_incomplete", label: "Description is incomplete" },
  { value: "duplicate", label: "Duplicate listing" },
  { value: "details_mismatch", label: "Property details do not match photos" },
  { value: "contact_invalid", label: "Contact details are invalid" },
] as const;

export type RejectReasonValue = (typeof REJECT_REASONS)[number]["value"];

const LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(
  REJECT_REASONS.map((r) => [r.value, r.label]),
);

/** Valid reason values, for server-side validation. */
export const REJECT_REASON_VALUES: string[] = REJECT_REASONS.map((r) => r.value);

/**
 * Join selected reason values + an optional free-text note into ONE full
 * reason string (stored untruncated in the DB). Format: the selected reasons'
 * labels comma-separated, then the free text. Unknown values are ignored.
 */
export function buildRejectReason(values: string[], note?: string | null): string {
  const labels = values.map((v) => LABEL_BY_VALUE[v]).filter(Boolean);
  const cleanNote = (note ?? "").trim();
  return [labels.join(", "), cleanNote].filter(Boolean).join(" — ");
}
