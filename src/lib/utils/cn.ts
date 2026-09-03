import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The design system defines custom font-size utilities via `@theme`
 * (--text-display-*, --text-price*, --text-meta, --text-overline). tailwind-merge
 * doesn't know these are font sizes, so by default it lumps e.g. `text-overline`
 * into the same conflict group as `text-white` / `text-success-700` (both are
 * `text-*`) and drops the colour, leaving elements with no explicit text colour.
 * That is exactly how a dark badge ended up with invisible dark text.
 *
 * Registering the custom sizes under the `font-size` group teaches tailwind-merge
 * that `text-overline` and `text-success-700` are different concerns, so both
 * survive a merge.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display-sm",
            "display-md",
            "display-lg",
            "display-xl",
            "price",
            "price-lg",
            "meta",
            "overline",
          ],
        },
      ],
    },
  },
});

/**
 * Merge Tailwind classes, letting later classes win over earlier ones.
 * Without twMerge, a variant's `px-4` and an override's `px-6` would both
 * land in the class list and the winner would depend on stylesheet order.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
