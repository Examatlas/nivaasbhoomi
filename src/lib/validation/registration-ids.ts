/**
 * Format validation for Indian business registration IDs. Used on BOTH the
 * client (inline feedback) and the server (source of truth) — never trust the
 * client. All three are OPTIONAL: empty is valid; only a non-empty value is
 * format-checked. Pure (no zod) so it's cheap to import into client bundles.
 */

/** Uppercase + strip ALL whitespace. Safe to run on every keystroke. */
export function normalizeRegId(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;
const UDYAM_RE = /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/;
// RERA numbers vary by state — no single national pattern. Enforce only a sane
// character set and length; the dealer enters it as issued by their state.
const RERA_RE = /^[A-Z0-9/-]{8,30}$/;

export type RegIdKind = "gst" | "udyam" | "rera";

/** null = valid (or empty). string = the error message. Normalizes internally. */
export function validateRegId(kind: RegIdKind, raw: string): string | null {
  const v = normalizeRegId(raw);
  if (!v) return null; // optional — only validate a non-empty value

  switch (kind) {
    case "gst":
      return GST_RE.test(v)
        ? null
        : "Enter a valid 15-character GSTIN (e.g. 22AAAAA0000A1Z5).";
    case "udyam":
      return UDYAM_RE.test(v)
        ? null
        : "Enter a valid Udyam number: UDYAM-XX-00-0000000.";
    case "rera":
      if (v.length < 8 || v.length > 30) return "RERA number must be 8–30 characters.";
      return RERA_RE.test(v) ? null : "Use only letters, numbers, hyphens and slashes.";
  }
}

/** Helper text shown under the RERA field. */
export const RERA_HELP =
  "Formats vary by state — enter it exactly as issued by your state RERA authority.";
