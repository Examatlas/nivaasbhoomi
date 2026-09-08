/**
 * Calendar-month quota reset helpers (STEP 3.2). Reset happens on the 1st of
 * each month (IST), not on a rolling 30-day clock.
 *
 * IST has no DST, so "the 1st in IST" is computed by shifting to the +05:30
 * offset. Kept pure so the reset cron's "is it the 1st?" gate and the
 * next-reset stamp are unit-testable without a clock.
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** The calendar day-of-month in IST for a given instant (default: now). */
export function istDayOfMonth(now: Date = new Date()): number {
  return new Date(now.getTime() + IST_OFFSET_MS).getUTCDate();
}

/** True when `now` falls on the 1st of the month in IST. */
export function isFirstOfMonthIST(now: Date = new Date()): boolean {
  return istDayOfMonth(now) === 1;
}

/**
 * A stable month key ("YYYY-MM" in IST) — used to make the reset idempotent:
 * a dealer already reset for the current key is skipped if the cron runs twice.
 */
export function istMonthKey(now: Date = new Date()): string {
  const d = new Date(now.getTime() + IST_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Instant of the CURRENT month's 1st 00:00 IST (start of this month). */
export function startOfMonthIST(now: Date = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const first = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1, 0, 0, 0);
  return new Date(first - IST_OFFSET_MS);
}

/** Instant of the NEXT 1st-of-month 00:00 IST after `now` — the next reset. */
export function nextMonthlyReset(now: Date = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  // First day of next month, 00:00 IST, expressed back in UTC.
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const firstNextIst = Date.UTC(y, m + 1, 1, 0, 0, 0);
  return new Date(firstNextIst - IST_OFFSET_MS);
}
