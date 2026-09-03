import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";

/**
 * Public route-group layout. Wraps every buyer-facing page (home, city,
 * locality, property, dealer profile, blog) with the shared header and footer.
 * The dealer and admin route groups deliberately do NOT use this chrome.
 */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
