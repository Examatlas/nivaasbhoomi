import { sendGAEvent } from "@next/third-parties/google";

import { gaEnabled } from "@/lib/analytics/config";

/**
 * Fire a GA4 custom event from a CLIENT component. No-ops unless GA is active
 * (env present + production), so call sites stay clean and dev never tracks.
 *
 * PRIVACY: never pass a phone number, email or name — only IDs and categories
 * (listingId, city, source, tool name, etc.). Keep params flat + scalar.
 */
export type TrackParams = Record<string, string | number | boolean | undefined | null>;

export function trackEvent(name: string, params?: TrackParams): void {
  if (!gaEnabled()) return;
  try {
    // @next/third-parties pushes to the dataLayer set up by <GoogleAnalytics/>.
    sendGAEvent("event", name, params ?? {});
  } catch {
    /* analytics must never break the app */
  }
}
