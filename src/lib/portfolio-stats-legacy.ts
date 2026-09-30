/**
 * Frozen snapshot of the pre-fix portfolio risk calculation.
 * Used only by before/after tests and scripts — not by the live page.
 *
 * Old behaviour: blendNav starts at max(first dates), so a short holding
 * (e.g. W06 from 2025-10) clips the whole NAV to <2 years, then max drawdown
 * falls back to a weight-average of each fund's own 3-year drawdown.
 */
import type { ChartPoint } from "./types";

const MS_YEAR = 365.25 * 86_400_000;
const MS_DAY = 86_400_000;

function lastTime(points: ChartPoint[]): number {
  return points[points.length - 1].t;
}

function sliceYears(points: ChartPoint[], years: number): ChartPoint[] {
  if (points.length < 2) return [];
  const cutoff = points[points.length - 1].t - years * MS_YEAR;
  const sliced = points.filter((point) => point.t >= cutoff);
  return sliced.length >= 2 ? sliced : [];
}

function spanYears(points: ChartPoint[]): number {
  if (points.length < 2) return 0;
  return (points[points.length - 1].t - points[0].t) / MS_YEAR;
}

function weightedMean(items: { weight: number; value: number | null }[]): number | null {
  let weight = 0;
  let sum = 0;
  for (const item of items) {
    if (item.value == null || !Number.isFinite(item.value) || item.weight <= 0) continue;
    weight += item.weight;
    sum += item.weight * item.value;
  }
  return weight > 0 ? sum / weight : null;
}

function blendNav(holdings: { weight: number; points: ChartPoint[] }[]): ChartPoint[] {
  const valid = holdings.filter((holding) => holding.points.length >= 2 && holding.weight > 0);
  if (valid.length === 0) return [];

  const latest = Math.max(...valid.map((holding) => lastTime(holding.points)));
  const fresh = valid.filter((holding) => latest - lastTime(holding.points) <= 21 * MS_DAY);
  const used = fresh.length > 0 ? fresh : valid;
  const start = Math.max(...used.map((holding) => holding.points[0].t));
  const end = Math.min(...used.map((holding) => lastTime(holding.points)));
  if (end <= start) return [];

  const times = [
    ...new Set(
      used.flatMap((holding) =>
        holding.points.filter((point) => point.t >= start && point.t <= end).map((point) => point.t),
      ),
    ),
  ].sort((a, b) => a - b);
  if (times.length < 2) return [];

  const totalWeight = used.reduce((sum, holding) => sum + holding.weight, 0);
  const series = used.map((holding) => {
    const sorted = holding.points;
    let index = 0;
    let last = sorted[0].price;
    const aligned: number[] = [];
    for (const time of times) {
      while (index < sorted.length && sorted[index].t <= time) {
        last = sorted[index].price;
        index += 1;
      }
      aligned.push(last);
    }
    return { weight: holding.weight / totalWeight, aligned, base: aligned[0] };
  });

  if (series.some((item) => item.base <= 0)) return [];

  return times.map((time, idx) => ({
    t: time,
    price: series.reduce((sum, item) => sum + item.weight * (item.aligned[idx] / item.base) * 100, 0),
  }));
}

function maxDrawdown(points: ChartPoint[]): number | null {
  if (points.length < 2) return null;
  let peak = points[0].price;
  let worst = 0;
  for (const point of points) {
    if (point.price > peak) peak = point.price;
    if (peak > 0) {
      const drawdown = point.price / peak - 1;
      if (drawdown < worst) worst = drawdown;
    }
  }
  return worst;
}

export type LegacyHolding = { weight: number; points: ChartPoint[] };

/**
 * Replicates the old max-drawdown number: blended NAV when ≥2 years,
 * otherwise a weighted average of each holding's 3-year (or full) drawdown.
 */
export function legacyMaxDrawdownPct(holdings: LegacyHolding[]): number | null {
  const nav = blendNav(holdings);
  const volWindow = sliceYears(nav, 5).length >= 30 ? sliceYears(nav, 5) : nav;
  const navIsLongEnough = spanYears(volWindow) >= 2 && volWindow.length >= 60;
  if (navIsLongEnough) return maxDrawdown(volWindow);

  return weightedMean(
    holdings.map((holding) => ({
      weight: holding.weight,
      value: maxDrawdown(
        sliceYears(holding.points, 3).length >= 10 ? sliceYears(holding.points, 3) : holding.points,
      ),
    })),
  );
}
