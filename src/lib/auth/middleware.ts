import { cookies } from "next/headers";

import { fail } from "@/lib/api/response";
import { verifySession } from "@/lib/auth/jwt";
import { ADMIN_COOKIE, STAFF_COOKIE, DEALER_COOKIE, USER_COOKIE } from "@/lib/auth/cookie";
import { connectDB } from "@/lib/db/connect";
import { Staff } from "@/lib/db/models/Staff";

/**
 * Server-side auth guards for route handlers (DEV-SPEC.txt Section 8).
 *
 * Admin auth is REAL: the guard reads the httpOnly session cookie and verifies
 * the JWT. Role and id come only from the verified token - never from anything
 * the client sends ("NEVER trust client-sent dealerId. Always session se lo").
 *
 * Dealer auth is Phase 4. requireDealer already verifies a real dealer cookie
 * when one is present; until dealer login exists it falls back to a dev-only
 * stub so the locality-request flow stays testable in development, and denies in
 * production.
 *
 * Each guard returns either { identity } (authorized) or { error } (a ready
 * NextResponse) - callers do `if ("error" in r) return r.error;`.
 */

export interface AdminIdentity {
  adminId: string;
  role: "admin";
}

export interface DealerIdentity {
  dealerId: string;
  role: "dealer";
}

export interface StaffIdentity {
  staffId: string;
  role: "staff";
}

export interface UserIdentity {
  userId: string;
  role: "user";
}

type Guarded<T> = { identity: T } | { error: ReturnType<typeof fail> };

/** Verified admin identity from the session cookie, or null. */
export async function getAdminSession(): Promise<AdminIdentity | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const claims = await verifySession(token);
  if (!claims || claims.role !== "admin") return null;
  return { adminId: claims.adminId, role: "admin" };
}

export async function requireAdmin(): Promise<Guarded<AdminIdentity>> {
  const identity = await getAdminSession();
  if (!identity) {
    return { error: fail("UNAUTHORIZED", "Admin authentication required.") };
  }
  return { identity };
}

/**
 * Verified STAFF identity, or null. Beyond signature/expiry, this re-reads the
 * Staff record every request and rejects when the account is inactive OR its
 * tokenVersion no longer matches the token's `tv` — so deactivating a staff
 * (which bumps tokenVersion) invalidates every live session immediately.
 */
export async function getStaffSession(): Promise<StaffIdentity | null> {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  const claims = await verifySession(token);
  if (!claims || claims.role !== "staff" || !claims.staffId) return null;
  await connectDB();
  const staff = await Staff.findById(claims.staffId, { status: 1, tokenVersion: 1 }).lean();
  if (!staff || staff.status !== "active") return null;
  if ((staff.tokenVersion ?? 0) !== claims.tv) return null; // revoked / bumped
  return { staffId: claims.staffId, role: "staff" };
}

export async function requireStaff(): Promise<Guarded<StaffIdentity>> {
  const identity = await getStaffSession();
  if (!identity) {
    return { error: fail("UNAUTHORIZED", "Staff sign-in required.") };
  }
  return { identity };
}

/** Verified dealer identity from the session cookie, or null. */
export async function getDealerSession(): Promise<DealerIdentity | null> {
  const token = (await cookies()).get(DEALER_COOKIE)?.value;
  const claims = await verifySession(token);
  if (!claims || claims.role !== "dealer" || !claims.dealerId) return null;
  return { dealerId: claims.dealerId, role: "dealer" };
}

export async function requireDealer(): Promise<Guarded<DealerIdentity>> {
  const identity = await getDealerSession();
  if (identity) return { identity };
  // Dealer login (WhatsApp OTP) is live, so a real session is always required -
  // no dev stub. The dealerId comes only from the verified JWT.
  return { error: fail("UNAUTHORIZED", "Please sign in as a dealer.") };
}

/** Verified buyer identity from the session cookie, or null. */
export async function getUserSession(): Promise<UserIdentity | null> {
  const token = (await cookies()).get(USER_COOKIE)?.value;
  const claims = await verifySession(token);
  if (!claims || claims.role !== "user" || !claims.userId) return null;
  return { userId: claims.userId, role: "user" };
}

export async function requireUser(): Promise<Guarded<UserIdentity>> {
  const identity = await getUserSession();
  if (identity) return { identity };
  // A buyer must sign in (WhatsApp OTP) before contacting a dealer. The userId
  // comes only from the verified JWT.
  return { error: fail("UNAUTHORIZED", "Please sign in to contact the dealer.") };
}

/**
 * Upload signature is available to any authenticated user (admin or dealer).
 * Returns the role so callers can shape the upload folder if needed.
 */
export async function requireUploader(): Promise<
  Guarded<AdminIdentity | DealerIdentity | StaffIdentity>
> {
  const admin = await getAdminSession();
  if (admin) return { identity: admin };
  const dealer = await getDealerSession();
  if (dealer) return { identity: dealer };
  const staff = await getStaffSession();
  if (staff) return { identity: staff };
  return { error: fail("UNAUTHORIZED", "Authentication required to upload.") };
}
