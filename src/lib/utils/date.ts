/**
 * Listing freshness.
 *
 * DEV-SPEC.txt Section 13: a listing expires 30 days after lastRefreshedAt.
 * Freshness is therefore a real trust signal, not decoration - a stale listing
 * on a competitor site is the single most common complaint from buyers, so we
 * surface age honestly on every card instead of hiding it.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type FreshnessLevel = "fresh" | "recent" | "ageing" | "stale";

export interface Freshness {
  /** Human label, e.g. "Today", "3 days ago", "2 weeks ago". */
  label: string;
  level: FreshnessLevel;
  /** Whole days since the listing was posted or last refreshed. */
  days: number;
}

/**
 * Buckets, tuned against the 30-day expiry window:
 *   fresh   0-2 days    green dot, worth calling out
 *   recent  3-7 days    neutral
 *   ageing  8-21 days   neutral, muted
 *   stale   22+ days    amber - approaching expiry
 */
export function getFreshness(
  refreshedAt: Date | string,
  now: Date = new Date(),
): Freshness {
  const then = typeof refreshedAt === "string" ? new Date(refreshedAt) : refreshedAt;
  const elapsed = now.getTime() - then.getTime();

  if (!Number.isFinite(elapsed) || elapsed < 0) {
    return { label: "Just now", level: "fresh", days: 0 };
  }

  const days = Math.floor(elapsed / DAY);

  let label: string;
  if (elapsed < HOUR) {
    label = "Just now";
  } else if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    label = hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  } else if (days === 1) {
    label = "Yesterday";
  } else if (days < 7) {
    label = `${days} days ago`;
  } else if (days < 14) {
    label = "Last week";
  } else if (days < 31) {
    const weeks = Math.floor(days / 7);
    label = `${weeks} weeks ago`;
  } else {
    const months = Math.floor(days / 30);
    label = months === 1 ? "1 month ago" : `${months} months ago`;
  }

  let level: FreshnessLevel;
  if (days <= 2) level = "fresh";
  else if (days <= 7) level = "recent";
  else if (days <= 21) level = "ageing";
  else level = "stale";

  return { label, level, days };
}
