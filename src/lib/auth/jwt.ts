import { SignJWT, jwtVerify, type JWTPayload } from "jose";

/**
 * JWT signing/verification with jose (DEV-SPEC.txt Section 8).
 *
 * jose is used (not jsonwebtoken) because token verification runs in the Edge
 * proxy as well as in Node route handlers, and jose works in both runtimes.
 * The secret comes from JWT_SECRET and is required - the app must not fall back
 * to a default in production.
 */

export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export type Role = "admin" | "dealer" | "user";

export interface AdminClaims extends JWTPayload {
  role: "admin";
  adminId: string;
}

export interface DealerClaims extends JWTPayload {
  role: "dealer";
  dealerId: string;
}

/**
 * Buyer session (WhatsApp OTP). A buyer must sign in before they can contact a
 * dealer; the buyer's id/phone come only from this verified token, never from
 * the client.
 */
export interface UserClaims extends JWTPayload {
  role: "user";
  userId: string;
  /** Present when this buyer is also a linked dealer (post-upgrade). */
  dealerId?: string;
}

export type SessionClaims = AdminClaims | DealerClaims | UserClaims;

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "JWT_SECRET is missing or too short (>=16 chars). Set it in .env.local.",
    );
  }
  return new TextEncoder().encode(secret);
}

/** Sign a 30-day session token. */
export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

/** Verify a token and return its claims, or null if invalid/expired. */
export async function verifySession(
  token: string | undefined,
): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (payload.role !== "admin" && payload.role !== "dealer" && payload.role !== "user")
      return null;
    return payload as SessionClaims;
  } catch {
    return null;
  }
}
