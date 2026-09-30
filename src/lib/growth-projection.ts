/**
 * Compound-growth projection for a portfolio.
 *
 * Policy fees are front-loaded: the first 5 years compound at `earlyAnnual`
 * (gross expected return minus the early policy fee), subsequent years at
 * `laterAnnual` (gross minus the later policy fee). Dividends are assumed
 * to be reinvested.
 *
 * All rates are annual fractions, e.g. 0.05 for 5% p.a.
 */
export function projectValue(
  principal: number,
  years: number,
  earlyAnnual: number | null,
  laterAnnual: number | null,
): number | null {
  if (!Number.isFinite(principal) || principal <= 0) return null;
  if (!Number.isInteger(years) || years < 1 || years > 50) return null;
  return projectValueExact(principal, years, earlyAnnual, laterAnnual);
}

/**
 * Same fee schedule as `projectValue`, but `years` may be fractional
 * (used by the anniversary review when a policy is mid-year).
 */
export function projectValueExact(
  principal: number,
  years: number,
  earlyAnnual: number | null,
  laterAnnual: number | null,
): number | null {
  if (!Number.isFinite(principal) || principal <= 0) return null;
  if (!Number.isFinite(years) || years <= 0 || years > 50) return null;
  if (earlyAnnual == null || !Number.isFinite(earlyAnnual) || earlyAnnual <= -1) return null;

  if (years <= 5) {
    const value = principal * (1 + earlyAnnual) ** years;
    return Number.isFinite(value) ? value : null;
  }

  if (laterAnnual == null || !Number.isFinite(laterAnnual) || laterAnnual <= -1) return null;
  const value = principal * (1 + earlyAnnual) ** 5 * (1 + laterAnnual) ** (years - 5);
  return Number.isFinite(value) ? value : null;
}

/** Year-end values from year 0 (principal) through `years`. */
export function projectPath(
  principal: number,
  years: number,
  earlyAnnual: number | null,
  laterAnnual: number | null,
): number[] | null {
  if (!Number.isInteger(years) || years < 1 || years > 50) return null;
  const path = [principal];
  for (let year = 1; year <= years; year += 1) {
    const value = projectValue(principal, year, earlyAnnual, laterAnnual);
    if (value == null) return null;
    path.push(value);
  }
  return path;
}

export type StressScenario = {
  path: number[];
  year1Value: number;
  endValue: number;
  yearsToRecover: number | null;
};

/**
 * Scenario (not a forecast): year 1 applies the portfolio's historical max
 * drawdown, then the account recovers at the after-fee rate.
 */
export function projectStressPath(
  principal: number,
  years: number,
  maxDrawdownPct: number | null,
  earlyAnnual: number | null,
  laterAnnual: number | null,
): StressScenario | null {
  if (!Number.isFinite(principal) || principal <= 0) return null;
  if (!Number.isInteger(years) || years < 1 || years > 50) return null;
  if (maxDrawdownPct == null || !Number.isFinite(maxDrawdownPct) || maxDrawdownPct >= 0) {
    return null;
  }
  if (maxDrawdownPct <= -1) return null;
  if (earlyAnnual == null || !Number.isFinite(earlyAnnual) || earlyAnnual <= -1) return null;

  const year1Value = principal * (1 + maxDrawdownPct);
  if (!Number.isFinite(year1Value) || year1Value <= 0) return null;

  const path = [principal, year1Value];
  let value = year1Value;
  let yearsToRecover: number | null = year1Value >= principal ? 1 : null;

  for (let year = 2; year <= Math.max(years, 50); year += 1) {
    const rate = year <= 5 ? earlyAnnual : laterAnnual;
    if (rate == null || !Number.isFinite(rate) || rate <= -1) {
      if (year <= years) return null;
      break;
    }
    value *= 1 + rate;
    if (!Number.isFinite(value)) return null;
    if (year <= years) path.push(value);
    if (yearsToRecover == null && value >= principal) yearsToRecover = year;
    if (year >= years && yearsToRecover != null) break;
  }

  return {
    path,
    year1Value,
    endValue: path[path.length - 1],
    yearsToRecover,
  };
}

/** Format a dollar amount as HK$1,234,567 (rounded to the nearest dollar). */
export function formatHKD(value: number): string {
  return `HK$${Math.round(value).toLocaleString("en-HK")}`;
}
