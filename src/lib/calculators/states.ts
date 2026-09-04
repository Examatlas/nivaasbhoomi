import { connectDB } from "@/lib/db/connect";
import { State } from "@/lib/db/models/State";
import {
  DEFAULT_STAMP_DUTY,
  FALLBACK_RATE,
  type StampDutyRate,
} from "@/lib/calculators/stamp-duty";

export interface StampDutyState {
  code: string;
  name: string;
  rate: StampDutyRate;
  /** True when the rate came from the DB rather than the default table. */
  fromDb: boolean;
}

/**
 * States for the stamp-duty calculator with resolved rates. A DB
 * State.stampDutyRate wins; otherwise the DEFAULT_STAMP_DUTY table (by code) or
 * the generic fallback fills in, so the tool always works. Falls back to the
 * whole default table if the DB is unreachable.
 */
export async function getStampDutyStates(): Promise<StampDutyState[]> {
  try {
    await connectDB();
    const states = await State.find(
      {},
      { name: 1, code: 1, stampDutyRate: 1 },
    )
      .sort({ name: 1 })
      .lean();

    if (states.length > 0) {
      return states.map((s) => {
        const db = s.stampDutyRate as Partial<StampDutyRate> | undefined;
        const table =
          (s.code && DEFAULT_STAMP_DUTY[s.code.toUpperCase()]) || FALLBACK_RATE;
        const rate: StampDutyRate = {
          male: db?.male ?? table.male,
          female: db?.female ?? table.female,
          joint: db?.joint ?? table.joint,
        };
        const fromDb =
          typeof db?.male === "number" ||
          typeof db?.female === "number" ||
          typeof db?.joint === "number";
        return { code: s.code, name: s.name, rate, fromDb };
      });
    }
  } catch {
    /* fall through to the static table */
  }

  // No states seeded (or DB error): expose the default table directly.
  return Object.entries(DEFAULT_STAMP_DUTY).map(([code, rate]) => ({
    code,
    name: code,
    rate,
    fromDb: false,
  }));
}
