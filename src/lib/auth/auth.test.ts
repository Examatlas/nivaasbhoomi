import { test } from "node:test";
import assert from "node:assert/strict";

import { SignJWT } from "jose";

// jwt/password read JWT_SECRET lazily (at call time), so setting it here — after
// the imports are evaluated but before any test runs — is sufficient.
process.env.JWT_SECRET = "test-secret-at-least-16-chars-long-000000";

import { hashPassword, verifyPassword, TIMING_DUMMY_HASH } from "@/lib/auth/password";
import { signSession, verifySession } from "@/lib/auth/jwt";
import { generateResetToken } from "@/lib/auth/password-reset";

function secretKey(secret = process.env.JWT_SECRET!): Uint8Array {
  return new TextEncoder().encode(secret);
}

// ---- password hashing (Item 1: bcrypt, never plaintext) ----

test("password: hash is bcrypt and never the plaintext", async () => {
  const hash = await hashPassword("Sup3rSecret!");
  assert.match(hash, /^\$2[aby]\$\d{2}\$/); // bcrypt signature
  assert.notEqual(hash, "Sup3rSecret!");
  assert.ok(hash.length >= 55);
});

test("password: verify round-trips and rejects the wrong password", async () => {
  const hash = await hashPassword("correct horse battery");
  assert.equal(await verifyPassword("correct horse battery", hash), true);
  assert.equal(await verifyPassword("wrong password", hash), false);
});

test("password: two hashes of the same password differ (salted)", async () => {
  const a = await hashPassword("samePassword123");
  const b = await hashPassword("samePassword123");
  assert.notEqual(a, b);
});

test("password: TIMING_DUMMY_HASH is a real hash that no real password matches", async () => {
  assert.match(TIMING_DUMMY_HASH, /^\$2[aby]\$/);
  assert.equal(await verifyPassword("anything at all", TIMING_DUMMY_HASH), false);
});

// ---- JWT sessions (Item 1: session persists; Item 3: rejects bad tokens) ----

test("jwt: buyer session round-trips", async () => {
  const token = await signSession({ role: "user", userId: "u1" });
  const claims = await verifySession(token);
  assert.equal(claims?.role, "user");
  assert.equal((claims as { userId?: string })?.userId, "u1");
});

test("jwt: dealer session round-trips", async () => {
  const token = await signSession({ role: "dealer", dealerId: "d1" });
  const claims = await verifySession(token);
  assert.equal(claims?.role, "dealer");
  assert.equal((claims as { dealerId?: string })?.dealerId, "d1");
});

test("jwt: undefined / empty token returns null", async () => {
  assert.equal(await verifySession(undefined), null);
  assert.equal(await verifySession(""), null);
});

test("jwt: a tampered token is rejected", async () => {
  const token = await signSession({ role: "dealer", dealerId: "d1" });
  const tampered = token.slice(0, -3) + (token.slice(-3) === "aaa" ? "bbb" : "aaa");
  assert.equal(await verifySession(tampered), null);
});

test("jwt: a token signed with a different secret is rejected", async () => {
  const forged = await new SignJWT({ role: "admin", adminId: "x" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secretKey("a-totally-different-secret-key-999999"));
  assert.equal(await verifySession(forged), null);
});

test("jwt: an unknown role is rejected", async () => {
  const weird = await new SignJWT({ role: "superuser", id: "x" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secretKey());
  assert.equal(await verifySession(weird), null);
});

test("jwt: an expired token is rejected", async () => {
  const expired = await new SignJWT({ role: "user", userId: "u1" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
    .sign(secretKey());
  assert.equal(await verifySession(expired), null);
});

// ---- reset tokens (Item 2) ----

test("reset token: 64 hex chars and unique per call", () => {
  const a = generateResetToken();
  const b = generateResetToken();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b);
});
