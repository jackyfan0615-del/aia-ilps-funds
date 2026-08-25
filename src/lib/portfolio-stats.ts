import type { ChartPoint } from "./types";

const MS_YEAR = 365.25 * 86_400_000;

export type PortfolioStats = {
  expectedPct: number | null;
  expectedHorizon: "1年" | "3年年化" | "5年年化";
  oneYearPct: number | null;
  threeYearCagrPct: number | null;
  fiveYearCagrPct: number | null;
  volPct: number | null;
  maxDrawdownPct: number | null;
  riskLabel: "偏低" | "中低" | "中等" | "偏高" | "高";
  asOf: number | null;
  coverage: number;
};

export function formatAbsPct(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(Math.abs(value) * 100).toFixed(digits)}%`;
}

export function formatSignedPct(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const pct = value * 100;
  const sign = pct > 0.005 ? "+" : "";
  return `${sign}${pct.toFixed(digits)}%`;
}

export function riskBadgeClass(label: PortfolioStats["riskLabel"] | string): string {
  if (label === "高" || label === "偏高") return "risk-high";
  if (label === "偏低" || label === "中低" || label === "低") return "risk-low";
  return "risk-mid";
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

function periodReturn(points: ChartPoint[], years: number, annualize: boolean): number | null {
  const sliced = sliceYears(points, years);
  if (sliced.length < 2 || sliced[0].price <= 0) return null;
  const span = spanYears(sliced);
  if (span < years * 0.7) return null;
  const ratio = sliced[sliced.length - 1].price / sliced[0].price;
  if (annualize && span >= 1.2) return Math.pow(ratio, 1 / span) - 1;
  return ratio - 1;
}

function weightedMean(items: { weight: number; value: number | null }[]): {
  value: number | null;
  coverage: number;
} {
  const total = items.reduce((sum, item) => sum + Math.max(item.weight, 0), 0);
  let weight = 0;
  let sum = 0;
  for (const item of items) {
    if (item.value == null || !Number.isFinite(item.value) || item.weight <= 0) continue;
    weight += item.weight;
    sum += item.weight * item.value;
  }
  return {
    value: weight > 0 ? sum / weight : null,
    coverage: total > 0 ? weight / total : 0,
  };
}

const MS_DAY = 86_400_000;

function lastTime(points: ChartPoint[]): number {
  return points[points.length - 1].t;
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

function annualizedVol(points: ChartPoint[]): number | null {
  if (points.length < 30) return null;
  const returns: number[] = [];
  for (let i = 1; i < points.length; i += 1) {
    if (points[i - 1].price > 0) {
      returns.push(points[i].price / points[i - 1].price - 1);
    }
  }
  if (returns.length < 20) return null;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252);
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

function riskFromVol(vol: number | null): PortfolioStats["riskLabel"] {
  if (vol == null) return "中等";
  const pct = vol * 100;
  if (pct < 5) return "偏低";
  if (pct < 10) return "中低";
  if (pct < 15) return "中等";
  if (pct < 22) return "偏高";
  return "高";
}

export function computePortfolioStats(
  holdings: { weight: number; points: ChartPoint[] }[],
): PortfolioStats {
  const covered = holdings.filter((holding) => holding.points.length >= 2);
  const coverage =
    holdings.reduce((sum, holding) => sum + holding.weight, 0) > 0
      ? covered.reduce((sum, holding) => sum + holding.weight, 0) /
        holdings.reduce((sum, holding) => sum + holding.weight, 0)
      : 0;

  const oneYear = weightedMean(
    holdings.map((holding) => ({
      weight: holding.weight,
      value: periodReturn(holding.points, 1, false),
    })),
  );
  const threeYear = weightedMean(
    holdings.map((holding) => ({
      weight: holding.weight,
      value: periodReturn(holding.points, 3, true),
    })),
  );
  const fiveYear = weightedMean(
    holdings.map((holding) => ({
      weight: holding.weight,
      value: periodReturn(holding.points, 5, true),
    })),
  );

  let expectedPct: number | null = null;
  let expectedHorizon: PortfolioStats["expectedHorizon"] = "1年";
  if (fiveYear.value != null && fiveYear.coverage >= 0.6) {
    expectedPct = fiveYear.value;
    expectedHorizon = "5年年化";
  } else if (threeYear.value != null && threeYear.coverage >= 0.6) {
    expectedPct = threeYear.value;
    expectedHorizon = "3年年化";
  } else if (oneYear.value != null) {
    expectedPct = oneYear.value;
    expectedHorizon = "1年";
  } else {
    expectedPct = threeYear.value ?? fiveYear.value;
    expectedHorizon = threeYear.value != null ? "3年年化" : "5年年化";
  }

  const nav = blendNav(holdings);
  const volWindow = sliceYears(nav, 5).length >= 30 ? sliceYears(nav, 5) : nav;
  const navIsLongEnough = spanYears(volWindow) >= 2 && volWindow.length >= 60;
  let volPct = navIsLongEnough ? annualizedVol(volWindow) : null;
  let maxDrawdownPct = navIsLongEnough ? maxDrawdown(volWindow) : null;

  if (volPct == null) {
    volPct = weightedMean(
      holdings.map((holding) => ({
        weight: holding.weight,
        value: annualizedVol(
          sliceYears(holding.points, 3).length >= 30 ? sliceYears(holding.points, 3) : holding.points,
        ),
      })),
    ).value;
  }
  if (maxDrawdownPct == null) {
    maxDrawdownPct = weightedMean(
      holdings.map((holding) => ({
        weight: holding.weight,
        value: maxDrawdown(
          sliceYears(holding.points, 3).length >= 10 ? sliceYears(holding.points, 3) : holding.points,
        ),
      })),
    ).value;
  }

  return {
    expectedPct,
    expectedHorizon,
    oneYearPct: oneYear.value,
    threeYearCagrPct: threeYear.value,
    fiveYearCagrPct: fiveYear.value,
    volPct,
    maxDrawdownPct,
    riskLabel: riskFromVol(volPct),
    asOf: nav.at(-1)?.t ?? covered[0]?.points.at(-1)?.t ?? null,
    coverage,
  };
}

export function holdingOneYearPct(points: ChartPoint[]): number | null {
  return periodReturn(points, 1, false);
}
