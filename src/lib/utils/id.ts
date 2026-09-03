import { randomInt } from "node:crypto";

/**
 * nanoid-compatible id generator (DEV-SPEC.txt Section 6 asks for "nanoid").
 *
 * Implemented on node:crypto rather than pulling the `nanoid` package: nanoid v5
 * is ESM-only, which adds CJS/ESM friction to the standalone seed script and the
 * slug unit tests for no behavioural gain. This gives the same thing the spec
 * actually needs - a short, URL-safe, cryptographically-random, lowercase
 * alphanumeric id - while keeping slug.ts dependency-free and runnable anywhere
 * (tsc, next build, tsx, node --test).
 */

// Lowercase alphanumeric only: [0-9a-z]. 36^6 ≈ 2.2 billion combinations, far
// more than enough to keep listing-slug collisions negligible.
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function nanoidLower(size = 6): string {
  let out = "";
  for (let i = 0; i < size; i++) {
    // randomInt is uniform and unbiased over [0, ALPHABET.length).
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}
