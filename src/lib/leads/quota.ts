import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { startOfMonthIST, nextMonthlyReset } from "@/lib/leads/quota-reset-date";

/**
 * Monthly lead-quota reset (STEP 3.2). CALENDAR-MONTH based: on the 1st of each
 * month every dealer's leadsUsedThisMonth goes back to 0.
 *
 * Implemented as ONE atomic updateMany over dealers not yet reset this month
 * (lastResetAt before this month's start, or never set). That makes it naturally
 * IDEMPOTENT: a second run the same day matches nobody, so it can't double-reset.
 * The cron route only calls this on the 1st (IST), per spec.
 */
export interface QuotaResetResult {
  reset: number;
}

export async function resetMonthlyQuotas(now: Date = new Date()): Promise<QuotaResetResult> {
  await connectDB();
  const monthStart = startOfMonthIST(now);

  const res = await Dealer.updateMany(
    { $or: [{ lastResetAt: null }, { lastResetAt: { $lt: monthStart } }] },
    {
      $set: {
        leadsUsedThisMonth: 0,
        lastResetAt: now,
        quotaResetAt: nextMonthlyReset(now),
      },
    },
  );

  return { reset: res.modifiedCount ?? 0 };
}
