"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Sheet - edge-anchored panel built on Radix Dialog. This is our mobile-first
 * container for the filter panel and the mobile nav: on a phone a bottom/side
 * sheet is far more thumb-reachable than a centred modal. As with Dialog, never
 * use a Sheet to gate content - only for user-initiated controls.
 */
export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetPortal = SheetPrimitive.Portal;

const sheetVariants = cva(
  [
    "fixed z-50 flex flex-col gap-4 bg-surface shadow-overlay",
    "transition ease-out-soft",
    "data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:animate-in data-[state=open]:duration-300",
  ].join(" "),
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 rounded-b-sheet border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 rounded-t-sheet border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-[86%] max-w-sm border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
        right:
          "inset-y-0 right-0 h-full w-[86%] max-w-sm border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

export function SheetContent({
  side,
  className,
  children,
  showClose = true,
  ...props
}: React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> &
  VariantProps<typeof sheetVariants> & { showClose?: boolean }) {
  return (
    <SheetPortal>
      <SheetPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-overlay backdrop-blur-[2px]",
          "data-[state=closed]:animate-out data-[state=open]:animate-in",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        )}
      />
      <SheetPrimitive.Content
        className={cn(sheetVariants({ side }), className)}
        {...props}
      >
        {children}
        {showClose && (
          <SheetPrimitive.Close
            className="absolute top-4 right-4 rounded-control p-1.5 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ink-600/25 focus-visible:outline-none"
            aria-label="Close"
          >
            <X className="size-4.5" />
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

export function SheetHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 border-b border-border p-5 pr-12", className)}
      {...props}
    />
  );
}

export function SheetFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-auto flex flex-col gap-2 border-t border-border p-5", className)}
      {...props}
    />
  );
}

export function SheetTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      className={cn("text-lg font-semibold text-ink-950", className)}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}
