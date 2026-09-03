import { AdminHeader } from "@/components/admin/admin-header";

/**
 * Admin route-group layout. Admin pages are client-side and dynamic (Section 9),
 * with their own chrome - deliberately NOT the public header/footer.
 *
 * AUTH: every /admin/* route (except /admin/login) is gated by the Edge proxy
 * (src/proxy.ts) on a valid admin session, and each admin API route also calls
 * requireAdmin(). There is no dev-mode open access.
 */
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AdminHeader />
      <main className="flex-1">{children}</main>
    </div>
  );
}
