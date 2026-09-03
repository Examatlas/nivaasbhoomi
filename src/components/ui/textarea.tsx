import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

/** Multi-line text input, matching the Input styling. Used for introText etc. */
export function Textarea({ className, invalid, rows = 5, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        "flex w-full rounded-control border bg-surface px-3.5 py-2.5 text-sm text-foreground",
        "shadow-subtle transition-[border-color,box-shadow] duration-150 ease-out-soft",
        "border-border-strong placeholder:text-subtle-foreground",
        "focus-visible:border-ink-500 focus-visible:ring-3 focus-visible:ring-ink-600/20 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "aria-[invalid=true]:border-danger-500",
        className,
      )}
      {...props}
    />
  );
}
