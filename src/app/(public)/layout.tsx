import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { SessionProvider } from "@/components/auth/session-provider";
import { ProfileCompletePopup } from "@/components/auth/profile-complete-popup";

/**
 * Public route-group layout. Wraps every buyer-facing page (home, city,
 * locality, property, dealer profile, blog) with the shared header and footer.
 * The dealer and admin route groups deliberately do NOT use this chrome.
 *
 * SessionProvider fetches the buyer session on the client so the header reflects
 * login state without making these ISR/static pages dynamic.
 */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <SessionProvider>
      <div className="flex min-h-dvh flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
      <ProfileCompletePopup />
    </SessionProvider>
  );
}
