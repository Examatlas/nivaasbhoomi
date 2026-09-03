/**
 * Lazy, single-flight loader for the Google Maps JavaScript API (+ Places).
 * (DEV-SPEC.txt Section 1: Google Maps JavaScript API + Places Autocomplete;
 * Section 10 CWV: only instantiate the map on scroll/interaction to save quota.)
 *
 * The script is injected at most once per page; concurrent callers share one
 * promise. Callers decide WHEN to call this (e.g. when the map scrolls into
 * view), which is what keeps it off the initial load.
 */

let loadPromise: Promise<typeof google> | null = null;

const CALLBACK = "__nbGmapsReady";

export function loadGoogleMaps(apiKey: string): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser."));
  }
  if (window.google?.maps) return Promise.resolve(window.google);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<typeof google>((resolve, reject) => {
    if (!apiKey) {
      reject(new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set."));
      return;
    }

    // Global callback the Maps script invokes once ready.
    (window as unknown as Record<string, () => void>)[CALLBACK] = () => {
      resolve(window.google);
    };

    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: apiKey,
      libraries: "places",
      callback: CALLBACK,
      loading: "async",
      v: "weekly",
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      loadPromise = null;
      reject(
        new Error("Failed to load Google Maps. Check the API key and enabled APIs."),
      );
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
