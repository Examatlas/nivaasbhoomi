/**
 * EMI calculator (DEV-SPEC.txt Section 17, Phase 8). Pure + side-effect free so
 * it is unit-tested directly and reused by the UI.
 *
 * Standard reducing-balance EMI:
 *   EMI = P·r·(1+r)^n / ((1+r)^n − 1)
 * where r = monthly rate (annual% / 12 / 100), n = tenure in months.
 */

export interface EmiInput {
  /** Loan principal in rupees. */
  principal: number;
  /** Annual interest rate as a percentage, e.g. 8.5. */
  annualRatePct: number;
  /** Tenure in months. */
  tenureMonths: number;
}

export interface EmiResult {
  emi: number;
  principal: number;
  totalInterest: number;
  totalPayment: number;
}

export function computeEmi(input: EmiInput): EmiResult {
  const principal = Math.max(0, Math.round(input.principal));
  const n = Math.max(1, Math.round(input.tenureMonths));
  const annual = Math.max(0, input.annualRatePct);

  if (principal === 0) {
    return { emi: 0, principal: 0, totalInterest: 0, totalPayment: 0 };
  }

  const r = annual / 12 / 100;
  let emi: number;
  if (r === 0) {
    emi = principal / n; // interest-free edge case
  } else {
    const pow = Math.pow(1 + r, n);
    emi = (principal * r * pow) / (pow - 1);
  }

  const emiRounded = Math.round(emi);
  const totalPayment = Math.round(emiRounded * n);
  const totalInterest = Math.max(0, totalPayment - principal);
  return { emi: emiRounded, principal, totalInterest, totalPayment };
}

/** Convenience: tenure in YEARS -> the full result. */
export function computeEmiYears(
  principal: number,
  annualRatePct: number,
  tenureYears: number,
): EmiResult {
  return computeEmi({ principal, annualRatePct, tenureMonths: Math.round(tenureYears * 12) });
}
