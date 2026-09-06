"use client";

import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import { groupINR, inrWords } from "@/lib/utils/price";

export type PriceInputProps = Omit<InputProps, "value" | "onChange" | "type"> & {
  /** Raw digit string, e.g. "500000". Empty string when blank. */
  value: string;
  /** Emits the raw digit string (no commas), for the parent to store as Number. */
  onChange: (rawDigits: string) => void;
};

/**
 * Price input with live Indian grouping (5,00,000) and an amount-in-words line
 * below. Displays formatted text (type="text" so commas render) but only ever
 * emits raw digits, so the caller stores a clean Number. Empty / zero / very
 * large are all handled.
 */
export function PriceInput({ value, onChange, className, ...props }: PriceInputProps) {
  const digits = value.replace(/\D/g, "");
  const n = digits ? Number(digits) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
          ₹
        </span>
        <Input
          type="text"
          inputMode="numeric"
          value={digits ? groupINR(n) : ""}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          className={cn("pl-7", className)}
          {...props}
        />
      </div>
      {n > 0 && (
        <p className="text-meta text-muted-foreground">
          ₹{groupINR(n)} — {inrWords(n)}
        </p>
      )}
    </div>
  );
}
