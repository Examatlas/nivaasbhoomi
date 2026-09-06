"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

export type PasswordInputProps = Omit<InputProps, "type"> & {
  /** Optional left-aligned icon (e.g. Lock), matching the existing field style. */
  icon?: React.ElementType;
};

/**
 * Password field with a show/hide toggle. Keyboard accessible (real <button>,
 * Tab/Enter/Space) with an aria-label that reflects state. Shares the base Input
 * so styling stays consistent everywhere.
 */
export function PasswordInput({ icon: Icon, className, ...props }: PasswordInputProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      {Icon && (
        <Icon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      )}
      <Input
        type={show ? "text" : "password"}
        className={cn(Icon && "pl-9", "pr-10", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-control text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-600/30"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
