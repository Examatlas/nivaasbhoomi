import { fail } from "@/lib/api/response";

/**
 * AUTH STUBS - Phase 1 placeholder.
 *
 * Real auth arrives later: dealer WhatsApp-OTP + JWT cookie in Phase 4, admin
 * email/password + JWT cookie in Phase 2 (DEV-SPEC.txt Section 8). Until then
 * these functions stand in for the real guards so routes can be written against
 * a stable interface and simply have their bodies swapped later.
 *
 * SAFETY: in production these DENY by default (return an UNAUTHORIZED response),
 * so nothing dealer- or admin-gated is ever exposed on a real deployment before
 * auth is wired. In development they allow through with a stub identity so the
 * admin location manager and the locality-request flow are usable now.
 *
 * Each returns either an identity object (authorized) or a NextResponse error
 * (blocked) - callers check with `if ("error" in result) return result.error`.
 */

const isDev = process.env.NODE_ENV !== "production";

export interface DealerIdentity {
  dealerId: string | null; // null in the dev stub - no dealers exist yet
  role: "dealer";
}

export interface AdminIdentity {
  adminId: string;
  role: "admin";
}

type Guarded<T> = { identity: T } | { error: ReturnType<typeof fail> };

/**
 * Dealer guard. Wire to JWT-cookie verification in Phase 4.
 * TODO(phase-4): read the httpOnly JWT, verify it, load the dealer.
 */
export function requireDealer(): Guarded<DealerIdentity> {
  if (isDev) {
    return { identity: { dealerId: null, role: "dealer" } };
  }
  return {
    error: fail("UNAUTHORIZED", "Dealer authentication is not available yet."),
  };
}

/**
 * Admin guard. Wire to admin JWT-cookie verification in Phase 2.
 * TODO(phase-2): read the httpOnly JWT, verify it carries the admin role.
 */
export function requireAdmin(): Guarded<AdminIdentity> {
  if (isDev) {
    return { identity: { adminId: "dev-admin", role: "admin" } };
  }
  return {
    error: fail("UNAUTHORIZED", "Admin authentication is not available yet."),
  };
}
