import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

/**
 * WhatsAppButton - THE reserved green action.
 *
 * This is the only component in the system allowed to use the `wa-*` palette.
 * It always renders as an <a> to a wa.me link, always carries the WhatsApp
 * glyph, and always means exactly one thing. Because green appears nowhere else
 * in the UI, a buyer scanning a page of cards can find "how do I contact" in
 * well under a second - which is the entire conversion mechanic of the site.
 *
 * Foreground is wa-ink (near-black), not white: white on #25D366 fails WCAG,
 * dark-on-green passes at ~11:1 and keeps the colour unmistakably "WhatsApp".
 */
const whatsappVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-semibold select-none",
    "rounded-control",
    "transition-[background-color,box-shadow,transform] duration-150 ease-out-soft",
    "outline-none focus-visible:ring-3 focus-visible:ring-wa-600/40",
    "active:scale-[0.99]",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      size: {
        sm: "h-9 px-3.5 text-sm [&_svg]:size-4",
        md: "h-11 px-5 text-sm [&_svg]:size-5",
        lg: "h-12 px-6 text-base [&_svg]:size-5",
      },
      block: {
        true: "w-full",
      },
      tone: {
        // Solid brand green - the primary contact action.
        solid: "bg-wa-500 text-wa-ink shadow-subtle hover:bg-wa-600",
        // Quiet green for dense contexts (card footers) where a full green
        // fill would be too loud against the photo.
        soft: "border border-wa-200 bg-wa-50 text-wa-ink hover:bg-wa-100",
      },
    },
    defaultVariants: {
      size: "md",
      tone: "solid",
    },
  },
);

/** WhatsApp glyph. Inline SVG so it ships zero extra requests. */
function WhatsAppGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .103 5.36.1 11.945c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.652a11.96 11.96 0 005.71 1.454h.005c6.582 0 11.945-5.361 11.945-11.945a11.9 11.9 0 00-3.495-8.408" />
    </svg>
  );
}

interface WhatsAppButtonBaseProps extends VariantProps<typeof whatsappVariants> {
  /** wa.me deep link. Build it with lib/utils/whatsapp. */
  href: string;
  className?: string;
  children?: React.ReactNode;
  /** Hide the glyph in very tight layouts. Defaults to shown. */
  hideIcon?: boolean;
}

export type WhatsAppButtonProps = WhatsAppButtonBaseProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className">;

export function WhatsAppButton({
  href,
  size,
  block,
  tone,
  hideIcon = false,
  className,
  children = "WhatsApp",
  ...props
}: WhatsAppButtonProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(whatsappVariants({ size, block, tone }), className)}
      {...props}
    >
      {!hideIcon && <WhatsAppGlyph />}
      {children}
    </a>
  );
}

export { WhatsAppGlyph, whatsappVariants };
