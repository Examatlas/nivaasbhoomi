/**
 * Staff route-group layout. Staff pages are dynamic and never cached, with their
 * own chrome (the StaffShell, rendered per-page so the login page stays bare).
 *
 * AUTH: every /staff/* route except /staff/login is gated by the Edge proxy
 * (src/proxy.ts) on a valid staff session, and each /api/staff/* route calls
 * requireStaff() — which re-reads the Staff record so a deactivated account is
 * rejected immediately.
 */
export const dynamic = "force-dynamic";

export default function StaffLayout({ children }: LayoutProps<"/staff">) {
  return children;
}
