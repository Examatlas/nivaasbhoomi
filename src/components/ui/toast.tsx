"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

/**
 * Toast, on sonner. Sonner is chosen over a Radix Toast wiring because it ships
 * a tiny runtime and needs a single mount point - good for our small-JS budget.
 *
 * Theming is done through CSS variables (sonner reads --normal-* etc.) so toasts
 * inherit the design system's surface, border and ink tokens instead of
 * sonner's defaults. Success toasts use ink, NOT green, to keep green reserved
 * for the WhatsApp action.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      gap={10}
      toastOptions={{
        classNames: {
          toast:
            "rounded-card border border-border bg-surface text-foreground shadow-lift",
          title: "text-sm font-semibold text-ink-950",
          description: "text-sm text-muted-foreground",
          actionButton: "bg-ink-900 text-primary-foreground rounded-control",
          cancelButton: "bg-surface-muted text-foreground rounded-control",
          error: "border-danger-100",
          success: "border-ink-100",
          warning: "border-warning-100",
        },
      }}
      style={
        {
          "--normal-bg": "var(--color-surface)",
          "--normal-text": "var(--color-foreground)",
          "--normal-border": "var(--color-border)",
        } as React.CSSProperties
      }
    />
  );
}

export { toast };
