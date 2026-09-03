import bcrypt from "bcryptjs";

/**
 * Password hashing (DEV-SPEC.txt Section 8: bcrypt). bcryptjs is a pure-JS,
 * bcrypt-compatible implementation - no native build, works on every platform,
 * and only ever runs in Node route handlers (never the Edge proxy).
 */

const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * A real bcrypt hash of a fixed throwaway string, computed once. The login route
 * compares against this when the email doesn't match, so a wrong email and a
 * wrong password cost the same time (no email-enumeration timing side channel).
 */
export const TIMING_DUMMY_HASH = bcrypt.hashSync(
  "nivaasbhoomi-timing-dummy",
  SALT_ROUNDS,
);
