import { test } from "node:test";
import assert from "node:assert/strict";

import { generateAgentKey, hashAgentKey, AGENT_KEY_PREFIX } from "./key";

test("agent key: format is prefix + base64url, plaintext never < 40 chars", () => {
  const { plaintext } = generateAgentKey();
  assert.ok(plaintext.startsWith(AGENT_KEY_PREFIX), "has nb_agent_ prefix");
  const body = plaintext.slice(AGENT_KEY_PREFIX.length);
  // 32 random bytes → 43 base64url chars, and base64url has no +/= or slashes.
  assert.match(body, /^[A-Za-z0-9_-]{43}$/);
});

test("agent key: hash is deterministic sha256 hex, last4 matches plaintext", () => {
  const { plaintext, hash, last4 } = generateAgentKey();
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hash, hashAgentKey(plaintext), "stored hash == hash of plaintext");
  assert.equal(last4, plaintext.slice(-4));
});

test("agent key: hashing is trim-insensitive (lookup survives stray whitespace)", () => {
  const { plaintext, hash } = generateAgentKey();
  assert.equal(hashAgentKey(`  ${plaintext}\n`), hash);
});

test("agent key: two generations never collide", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 500; i++) seen.add(generateAgentKey().plaintext);
  assert.equal(seen.size, 500);
});

test("agent key: last4 is exactly the display suffix, not the whole key", () => {
  const { plaintext, last4 } = generateAgentKey();
  assert.equal(last4.length, 4);
  assert.ok(plaintext.length > last4.length, "last4 is a suffix, never the full key");
  assert.ok(plaintext.endsWith(last4));
});
