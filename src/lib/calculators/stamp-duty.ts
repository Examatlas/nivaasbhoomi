/**
 * State-wise stamp duty calculator (DEV-SPEC.txt Section 17, Phase 8).
 *
 * Stamp duty is a percentage of the property value that varies by STATE and
 * often by the BUYER's category (many states give women a concession). Rates are
 * read from State.stampDutyRate { male, female, joint } when present; this module
 * carries a sensible DEFAULT table (well-known headline rates) so the calculator
 * works before the DB is populated, and the pure math is unit-tested.
 *
 * Registration charge is a separate, usually ~1% fee; it's included as an
 * approximate line so the "total cost" is realistic.
 */

export type BuyerCategory = "male" | "female" | "joint";

export interface StampDutyRate {
  male: number;
  female: number;
  joint: number;
}

/** Approximate headline stamp-duty % by state code (fallback when not in the DB).
 *  These are indicative; the DB value (State.stampDutyRate) overrides them. */
export const DEFAULT_STAMP_DUTY: Record<string, StampDutyRate> = {
  JH: { male: 7, female: 7, joint: 7 }, // Jharkhand (nominal Re.1 for women in some cases; using headline)
  BR: { male: 6, female: 5.7, joint: 6 }, // Bihar
  MH: { male: 6, female: 5, joint: 6 }, // Maharashtra
  DL: { male: 6, female: 4, joint: 5 }, // Delhi
  UP: { male: 7, female: 6, joint: 7 }, // Uttar Pradesh
  KA: { male: 5, female: 5, joint: 5 }, // Karnataka
  TN: { male: 7, female: 7, joint: 7 }, // Tamil Nadu
  GJ: { male: 4.9, female: 4.9, joint: 4.9 }, // Gujarat
  RJ: { male: 6, female: 5, joint: 6 }, // Rajasthan
  WB: { male: 6, female: 6, joint: 6 }, // West Bengal
  MP: { male: 7.5, female: 7.5, joint: 7.5 }, // Madhya Pradesh
  TS: { male: 6, female: 6, joint: 6 }, // Telangana
};

/** A generic fallback when a state code isn't in the table. */
export const FALLBACK_RATE: StampDutyRate = { male: 6, female: 5, joint: 6 };

/** Typical registration charge (% of value), capped in some states but modelled flat here. */
export const REGISTRATION_PCT = 1;

export interface StampDutyInput {
  propertyValue: number;
  ratePct: number;
  registrationPct?: number;
}

export interface StampDutyResult {
  propertyValue: number;
  ratePct: number;
  stampDuty: number;
  registrationPct: number;
  registration: number;
  total: number;
}

export function computeStampDuty(input: StampDutyInput): StampDutyResult {
  const value = Math.max(0, Math.round(input.propertyValue));
  const ratePct = Math.max(0, input.ratePct);
  const registrationPct = Math.max(0, input.registrationPct ?? REGISTRATION_PCT);

  const stampDuty = Math.round((value * ratePct) / 100);
  const registration = Math.round((value * registrationPct) / 100);
  return {
    propertyValue: value,
    ratePct,
    stampDuty,
    registrationPct,
    registration,
    total: stampDuty + registration,
  };
}

// ---- Lead-magnet breakdown (Phase 1 tool) ----

export type PropertyType = "residential" | "commercial" | "plot";
export type AreaType = "urban" | "rural";

export interface StampDutyBreakdownInput {
  propertyValue: number;
  stampDutyPct: number;
  registrationPct: number;
  /** The general/male rate, so a female/joint concession can be shown explicitly. */
  baseStampDutyPct?: number;
}

export interface StampDutyBreakdown {
  propertyValue: number;
  stampDutyPct: number;
  stampDuty: number;
  registrationPct: number;
  registration: number;
  /** stampDuty + registration — the extra a buyer pays on top of the price. */
  totalAdditional: number;
  /** propertyValue + totalAdditional. */
  grandTotal: number;
  /** Rupees saved vs the general/male rate (0 when there's no concession). */
  rebate: number;
}

/** Full cost breakdown for the calculator + the captured lead. Pure + rounded. */
export function computeStampDutyBreakdown(input: StampDutyBreakdownInput): StampDutyBreakdown {
  const value = Math.max(0, Math.round(input.propertyValue));
  const stampDutyPct = Math.max(0, input.stampDutyPct);
  const registrationPct = Math.max(0, input.registrationPct);
  const basePct = Math.max(stampDutyPct, input.baseStampDutyPct ?? stampDutyPct);

  const stampDuty = Math.round((value * stampDutyPct) / 100);
  const registration = Math.round((value * registrationPct) / 100);
  const totalAdditional = stampDuty + registration;
  const rebate = Math.round((value * (basePct - stampDutyPct)) / 100);

  return {
    propertyValue: value,
    stampDutyPct,
    stampDuty,
    registrationPct,
    registration,
    totalAdditional,
    grandTotal: value + totalAdditional,
    rebate,
  };
}

/** Resolve the rate for a state code + buyer category, DB value winning. */
export function resolveRate(
  stateCode: string | undefined,
  category: BuyerCategory,
  dbRate?: Partial<StampDutyRate> | null,
): number {
  const fromDb = dbRate?.[category];
  if (typeof fromDb === "number" && fromDb > 0) return fromDb;
  const table = (stateCode && DEFAULT_STAMP_DUTY[stateCode.toUpperCase()]) || FALLBACK_RATE;
  return table[category];
}
