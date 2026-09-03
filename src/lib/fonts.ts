import { Plus_Jakarta_Sans, Hind } from "next/font/google";

/**
 * Font pairing (DEV-SPEC.txt design brief: must support Latin AND Devanagari,
 * since Hindi content is coming).
 *
 * Plus Jakarta Sans - display / headings. A geometric humanist sans that reads
 * as a modern product, not a classifieds site. Variable, Latin only.
 *
 * Hind - body text and, critically, all Devanagari. Drawn by the Indian Type
 * Foundry with Latin and Devanagari on shared metrics, so mixed Hindi/English
 * lines stay on one baseline. Its tall x-height holds up on the low-DPI panels
 * common on the mid-range Android phones that are 80% of our traffic.
 *
 * Both self-host via next/font (no Google request at runtime) and use
 * display: "swap" so text paints immediately - directly serving the sub-2s LCP
 * target. We only pull the weights the design system actually uses, to keep the
 * font payload small.
 */

export const fontDisplay = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
  adjustFontFallback: true,
});

export const fontSans = Hind({
  subsets: ["latin", "devanagari"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-hind",
  display: "swap",
  adjustFontFallback: true,
});

/** Applied on <html> so both CSS variables resolve everywhere. */
export const fontVariables = `${fontDisplay.variable} ${fontSans.variable}`;
