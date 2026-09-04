import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";

/**
 * Monthly lead-quota reset (DEV-SPEC.txt Section 12).
 *
 * For every dealer whose quotaResetAt has passed: reset leadsUsedThisMonth to 0
 * and advance quotaResetAt by 30 days. Run daily at 00:05 IST by the cron route
 * / script. Idempotent - running it twice in a day is a no-op the second time
 * (quotaResetAt has already moved into the future).
 */
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface QuotaResetResult {
  reset: number;
}

export async function resetExpiredQuotas(now: Date = new Date()): Promise<QuotaResetResult> {
  await connectDB();

  // Dealers whose window has elapsed (or was never set - a freshly-created
  // dealer with no quotaResetAt gets one now).
  const due = await Dealer.find(
    { $or: [{ quotaResetAt: { $lte: now } }, { quotaResetAt: null }] },
    { quotaResetAt: 1 },
  ).lean();

  let reset = 0;
  for (const d of due) {
    // Advance from the previous reset point when possible so the cadence stays
    // on a fixed 30-day grid; otherwise start the clock now.
    const base = d.quotaResetAt && d.quotaResetAt <= now ? d.quotaResetAt : now;
    const next = new Date(base.getTime() + THIRTY_DAYS_MS);
    await Dealer.updateOne(
      { _id: d._id },
      { $set: { leadsUsedThisMonth: 0, quotaResetAt: next } },
    );
    reset += 1;
  }

  return { reset };
}
