import { SignJWT, jwtVerify } from "jose";

/**
 * Short-lived "verified phone" token for dealer self-signup (STEP 1).
 *
 * When a dealer verifies their WhatsApp OTP but has NO dealer account yet, we do
 * NOT create a User (that was the orphan-User bug — a persisted account before
 * the form is even submitted). Instead we mint this 15-minute token proving the
 * phone was verified, hand it to the registration page via a short-lived cookie,
 * and only on form submit does /api/auth/dealer/complete-signup create the
 * User + Dealer together. Abandon the form → the token expires → nothing persists.
 *
 * Signed with the same JWT_SECRET as sessions (jose, Edge-safe) but with a
 * distinct `purpose`, so a signup token can never be used as a login session
 * and vice-versa.
 */
export const SIGNUP_TOKEN_MAX_AGE_SECONDS = 15 * 60; // 15 minutes

export interface SignupTokenClaims {
  purpose: "dealer_signup";
  /** Canonical 91XXXXXXXXXX — the OTP-verified number. */
  phone: string;
}

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET is missing or too short (>=16 chars). Set it in .env.local.");
  }
  return new TextEncoder().encode(secret);
}

/** Mint a 15-minute dealer-signup token for a verified phone. */
export async function signSignupToken(phone: string): Promise<string> {
  return new SignJWT({ purpose: "dealer_signup", phone } satisfies SignupTokenClaims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SIGNUP_TOKEN_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

/** Verify a signup token; returns its claims, or null if invalid/expired/wrong purpose. */
export async function verifySignupToken(
  token: string | undefined,
): Promise<SignupTokenClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (payload.purpose !== "dealer_signup" || typeof payload.phone !== "string") return null;
    return { purpose: "dealer_signup", phone: payload.phone };
  } catch {
    return null;
  }
}
