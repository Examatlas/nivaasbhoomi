/**
 * Google Analytics 4 config (pure — safe to import from server components).
 *
 * GA is loaded ONLY when:
 *   - NEXT_PUBLIC_GA_MEASUREMENT_ID is set (env present), AND
 *   - the app is running in production (never in dev, so local testing never
 *     pollutes the GA property).
 * If the env var is missing, nothing loads.
 *
 * Both values are read from process.env at call time. Next inlines
 * NEXT_PUBLIC_* and NODE_ENV at build, so the client bundle evaluates these to
 * literals; on the server they read the real environment.
 */
export function gaMeasurementId(): string {
  return process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";
}

/** True when GA should be active (env present + production). */
export function gaEnabled(): boolean {
  return process.env.NODE_ENV === "production" && gaMeasurementId().length > 0;
}
