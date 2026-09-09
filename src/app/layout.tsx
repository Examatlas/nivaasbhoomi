import type { Metadata, Viewport } from "next";
import "./globals.css";
import { fontVariables } from "@/lib/fonts";
import { Toaster } from "@/components/ui/toast";
import { Analytics } from "@/components/analytics/analytics";
import { SITE_URL } from "@/lib/seo/site";

export const metadata: Metadata = {
  // SITE_URL is resolved defensively (empty/invalid env -> safe default), so
  // this never throws "Invalid URL" during the build. See lib/seo/site.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "NivaasBhoomi - Verified Property across India",
    template: "%s | NivaasBhoomi",
  },
  description:
    "Find verified flats, plots and houses across India and contact dealers directly on WhatsApp. No spam calls, no hidden phone numbers.",
  applicationName: "NivaasBhoomi",
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#f8f7f4",
  width: "device-width",
  initialScale: 1,
  // Buyers zoom to inspect property photos - never disable it.
  maximumScale: 5,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
