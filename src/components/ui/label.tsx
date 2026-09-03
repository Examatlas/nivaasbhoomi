import * as React from "react";
import { Label as LabelPrimitive } from "radix-ui";
import { cn } from "@/lib/utils/cn";

export type LabelProps = React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & {
  /** Appends a clay asterisk. Required fields are marked, optional ones aren't. */
  required?: boolean;
};

export function Label({ className, required, children, ...props }: LabelProps) {
  return (
    <LabelPrimitive.Root
      className={cn(
        "text-sm font-medium text-foreground",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
        className,
      )}
      {...props}
    >
      {children}
      {required && (
        <span className="ml-0.5 text-clay-600" aria-hidden="true">
          *
        </span>
      )}
    </LabelPrimitive.Root>
  );
}
