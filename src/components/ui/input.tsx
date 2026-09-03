import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** Renders the error ring and wires aria-invalid. Pair with FieldError. */
  invalid?: boolean;
};

/**
 * Text input. Height matches Button md (h-11) so inputs and buttons align on a
 * shared 44px baseline - the minimum comfortable touch target on the mid-range
 * Android phones that are most of our traffic.
 */
export function Input({ className, type = "text", invalid, ...props }: InputProps) {
  return (
    <input
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        "flex h-11 w-full rounded-control border bg-surface px-3.5 text-sm text-foreground",
        "shadow-subtle transition-[border-color,box-shadow] duration-150 ease-out-soft",
        "placeholder:text-subtle-foreground",
        "border-border-strong",
        "focus-visible:border-ink-500 focus-visible:ring-3 focus-visible:ring-ink-600/20 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "aria-[invalid=true]:border-danger-500 aria-[invalid=true]:focus-visible:ring-danger-500/25",
        className,
      )}
      {...props}
    />
  );
}
