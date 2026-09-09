import { GoogleAnalytics } from "@next/third-parties/google";

import { gaEnabled, gaMeasurementId } from "@/lib/analytics/config";

/**
 * Loads Google Analytics 4 via @next/third-parties (optimized, non
 * render-blocking) — ONLY in production and ONLY when the measurement id is
 * set. Renders nothing otherwise (dev, or env missing). Server component.
 */
export function Analytics() {
  if (!gaEnabled()) return null;
  return <GoogleAnalytics gaId={gaMeasurementId()} />;
}
