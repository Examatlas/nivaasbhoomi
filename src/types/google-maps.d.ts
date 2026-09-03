/// <reference types="google.maps" />

// Pull in the @types/google.maps global `google` namespace project-wide and
// expose window.google for the lazy loader.
declare global {
  interface Window {
    google: typeof google;
  }
}

export {};
