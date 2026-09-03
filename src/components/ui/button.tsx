import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

/**
 * Button.
 *
 * Note what is deliberately NOT here: there is no green/"success" primary
 * variant. WhatsApp green is reserved for the single WhatsApp action, and that
 * lives in its own <WhatsAppButton>. Keeping it out of the general Button means
 * a stray `variant="success"` can never accidentally dilute the one colour that
 * has to always mean the same thing.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-medium select-none",
    "rounded-control",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-150",
    "ease-out-soft",
    "outline-none focus-visible:ring-3 focus-visible:ring-ink-600/25",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.99]",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-subtle hover:bg-primary-hover",
        accent: "bg-accent text-accent-foreground shadow-subtle hover:bg-clay-700",
        outline:
          "border border-border-strong bg-surface text-foreground hover:bg-surface-muted",
        subtle: "bg-surface-muted text-foreground hover:bg-sand-200",
        ghost: "text-foreground hover:bg-surface-muted",
        link: "text-ink-700 underline-offset-4 hover:underline",
        danger: "bg-danger-600 text-white shadow-subtle hover:bg-danger-700",
      },
      size: {
        sm: "h-9 px-3.5 text-sm [&_svg]:size-4",
        md: "h-11 px-5 text-sm [&_svg]:size-4.5",
        lg: "h-12 px-6 text-base [&_svg]:size-5",
        icon: "size-11 [&_svg]:size-5",
      },
      block: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as the child element (e.g. an <a> or <Link>) via Radix Slot. */
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  type,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, block }), className)}
      // A bare <button> in a form defaults to type="submit"; make the safe
      // default explicit so a decorative button never submits by accident.
      type={asChild ? undefined : (type ?? "button")}
      {...props}
    />
  );
}

export { buttonVariants };
