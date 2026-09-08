/**
 * Small display helpers for listing fields shared between the card and the
 * property detail page, so the same raw value always renders the same label.
 */

/** Human label for possessionStatus, or null when unset/unknown. */
export function possessionLabel(status?: string | null): string | null {
  if (!status) return null;
  switch (status) {
    case "ready-to-move":
      return "Ready to Move";
    case "under-construction":
      return "Under Construction";
    default:
      // Fall back to a title-cased version of an unexpected value.
      return status
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
  }
}

/** True when the status means the property is still being built. */
export function isUnderConstruction(status?: string | null): boolean {
  return status === "under-construction";
}
