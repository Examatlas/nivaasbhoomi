/**
 * Post-auth navigation helpers (client-safe).
 *
 * After a login / OTP verify / logout the session COOKIES change. A soft
 * `router.replace()` + `router.refresh()` does not re-run the client-side
 * session state (SessionProvider), so the destination could show a stale header
 * until a manual reload — and if the soft transition stalls, a button that keeps
 * its spinner for the navigation hangs forever. A HARD navigation reloads the
 * destination with the new cookies: fresh server render, the companion hint
 * cookie is read on first paint, and the spinner ends because the page unloads.
 */

/** Full-document navigation. No-op on the server (guarded for SSR/tests). */
export function hardNavigate(url: string): void {
  if (typeof window !== "undefined") {
    window.location.assign(url);
  }
}

/**
 * fetch() bounded by a timeout so a hung network call rejects instead of leaving
 * a button spinning. Rejects with an Error named "TimeoutError" on timeout (same
 * shape apiFetch checks), so callers can show a clear message. Used by the raw
 * (non-apiFetch) auth calls: dealer password login and logout.
 */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = 15_000,
): Promise<Response> {
  return fetch(input, { ...init, signal: init.signal ?? AbortSignal.timeout(timeoutMs) });
}

/** True when a caught error is an abort/timeout from the helpers above. */
export function isTimeout(err: unknown): boolean {
  const name = (err as Error | undefined)?.name;
  return name === "TimeoutError" || name === "AbortError";
}
