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
  if (earlyAnnual == null || !Number.isFinite(earlyAnnual) || earlyAnnual <= -1) return null;

  const earlyYears = Math.min(years, 5);
  const laterYears = years - 5;
  if (laterYears > 0) {
    if (laterAnnual == null || !Number.isFinite(laterAnnual) || laterAnnual <= -1) return null;
  }

  const value =
    principal * (1 + earlyAnnual) ** earlyYears * (1 + (laterAnnual ?? 0)) ** Math.max(laterYears, 0);
  return Number.isFinite(value) ? value : null;
}

/** Format a dollar amount as HK$1,234,567 (rounded to the nearest dollar). */
export function formatHKD(value: number): string {
  return `HK$${Math.round(value).toLocaleString("en-HK")}`;
}
