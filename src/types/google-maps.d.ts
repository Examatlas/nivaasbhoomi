/// <reference types="google.maps" />

// Pull in the @types/google.maps global `google` namespace project-wide and
// expose window.google for the lazy loader.
declare global {
  interface Window {
    google: typeof google;
    /** Google Maps calls this on auth/activation failures (e.g. key invalid,
     *  Maps JavaScript API not enabled). We use it for graceful fallback. */
    gm_authFailure?: () => void;
  }
}

export {};
