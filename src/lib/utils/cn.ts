import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes, letting later classes win over earlier ones.
 * Without twMerge, a variant's `px-4` and an override's `px-6` would both
 * land in the class list and the winner would depend on stylesheet order.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
