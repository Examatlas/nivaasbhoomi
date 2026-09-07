import { SignJWT, jwtVerify } from "jose";

/**
 * Signed tokens embedded in a property-alert's WhatsApp link, so a buyer can
 * open their alerts (recording a "visit") or unsubscribe WITHOUT logging in.
 * Signed with JWT_SECRET (same secret as the session JWTs), 90-day validity.
 */
function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) throw new Error("JWT_SECRET is required for alert tokens.");
  return new TextEncoder().encode(s);
}

export interface AlertToken {
  /** Canonical phone the alert belongs to. */
  phone: string;
  purpose: "alert";
}

export async function signAlertToken(phone: string): Promise<string> {
  return new SignJWT({ phone, purpose: "alert" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("90d")
    .sign(secret());
}

export async function verifyAlertToken(token: string | undefined): Promise<AlertToken | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (payload.purpose !== "alert" || typeof payload.phone !== "string") return null;
    return { phone: payload.phone, purpose: "alert" };
  } catch {
    return null;
  }
}
