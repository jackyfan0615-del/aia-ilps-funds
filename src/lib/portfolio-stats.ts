import { computeDividendSource, type DividendSource } from "./dividend-source";
import type { PriceProxyUse } from "./price-proxies";
import type { ChartPoint } from "./types";

const MS_YEAR = 365.25 * 86_400_000;

export type DrawdownProxyNote = PriceProxyUse & {
  code: string;
};

export type PortfolioStats = {
  expectedPct: number | null;
  expectedHorizon: "1年" | "3年年化" | "5年年化";
  oneYearPct: number | null;
  threeYearCagrPct: number | null;
  fiveYearCagrPct: number | null;
  volPct: number | null;
  maxDrawdownPct: number | null;
  maxDrawdownFrom: number | null;
  maxDrawdownTo: number | null;
  drawdownProxies: DrawdownProxyNote[];
  drawdownOmitted: string[];
  riskLabel: "偏低" | "中低" | "中等" | "偏高" | "高";
  dividendYieldPct: number | null;
  dividendYieldMethod: "ttm" | "annualized" | null;
  oneYearTotalPct: number | null;
  dividendSource: DividendSource | null;
  /** Compact monthly blended NAV (own prices) for review / since-start returns. */
  navPoints: ChartPoint[];
  asOf: number | null;
  coverage: number;
};

export type HoldingStatsInput = {
  code?: string;
  weight: number;
  points: ChartPoint[];
  /** Own or proxy-extended series used only for the blended max-drawdown NAV. */
  riskPoints?: ChartPoint[];
  drawdownProxy?: PriceProxyUse | null;
  omittedFromDrawdown?: boolean;
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

export function periodReturn(points: ChartPoint[], years: number, annualize: boolean): number | null {
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

/** Keep month-end points plus the first/last print so review payloads stay small. */
export function compactMonthlyNav(points: ChartPoint[]): ChartPoint[] {
  if (points.length <= 80) return points;
  const byMonth = new Map<string, ChartPoint>();
  for (const point of points) {
    const year = new Date(point.t).toLocaleString("en-US", { timeZone: "Asia/Hong_Kong", year: "numeric" });
    const month = new Date(point.t).toLocaleString("en-US", { timeZone: "Asia/Hong_Kong", month: "2-digit" });
    byMonth.set(`${year}-${month}`, point);
  }
  const monthly = [...byMonth.values()].sort((a, b) => a.t - b.t);
  if (monthly[0]?.t !== points[0].t) monthly.unshift(points[0]);
  if (monthly[monthly.length - 1]?.t !== points[points.length - 1].t) {
    monthly.push(points[points.length - 1]);
  }
  return monthly;
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

export function computePortfolioStats(holdings: HoldingStatsInput[]): PortfolioStats {
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

  const drawdownProxies: DrawdownProxyNote[] = [];
  const drawdownOmitted: string[] = [];
  const riskHoldings = holdings.map((holding) => {
    if (holding.omittedFromDrawdown) {
      if (holding.code) drawdownOmitted.push(holding.code);
      return { weight: holding.weight, points: [] as ChartPoint[] };
    }
    if (holding.drawdownProxy && holding.code) {
      drawdownProxies.push({ code: holding.code, ...holding.drawdownProxy });
    }
    return { weight: holding.weight, points: holding.riskPoints ?? holding.points };
  });

  const riskNav = blendNav(riskHoldings);
  const drawdownWindow = sliceYears(riskNav, 5).length >= 10 ? sliceYears(riskNav, 5) : riskNav;
  const maxDrawdownPct = maxDrawdown(drawdownWindow);

  return {
    expectedPct,
    expectedHorizon,
    oneYearPct: oneYear.value,
    threeYearCagrPct: threeYear.value,
    fiveYearCagrPct: fiveYear.value,
    volPct,
    maxDrawdownPct,
    maxDrawdownFrom: drawdownWindow.at(0)?.t ?? null,
    maxDrawdownTo: drawdownWindow.at(-1)?.t ?? null,
    drawdownProxies,
    drawdownOmitted,
    riskLabel: riskFromVol(volPct),
    dividendYieldPct: null,
    dividendYieldMethod: null,
    oneYearTotalPct: null,
    dividendSource: null,
    navPoints: compactMonthlyNav(nav),
    asOf: nav.at(-1)?.t ?? covered[0]?.points.at(-1)?.t ?? null,
    coverage,
  };
}

export function formatZhYearMonth(ts: number): string {
  const year = new Date(ts).toLocaleString("en-US", { timeZone: "Asia/Hong_Kong", year: "numeric" });
  const month = new Date(ts).toLocaleString("en-US", { timeZone: "Asia/Hong_Kong", month: "2-digit" });
  return `${year}年${month}月`;
}

export function drawdownPeriodRange(stats: PortfolioStats): string | null {
  if (stats.maxDrawdownFrom == null || stats.maxDrawdownTo == null) return null;
  return `${formatZhYearMonth(stats.maxDrawdownFrom)}至${formatZhYearMonth(stats.maxDrawdownTo)}`;
}

export function drawdownPeriodLabel(stats: PortfolioStats): string {
  const range = drawdownPeriodRange(stats);
  if (!range) return "組合高峰至低位";
  return `${range} · 組合高峰至低位`;
}

export function drawdownDisclosure(stats: PortfolioStats): string | null {
  const parts: string[] = [];
  for (const proxy of stats.drawdownProxies) {
    if (proxy.until == null) {
      parts.push(`${proxy.code} 以 ${proxy.proxyCode} 代理全程走勢（${proxy.reasonZh}）。`);
    } else {
      parts.push(
        `${proxy.code} 於 ${formatZhYearMonth(proxy.until)}前以 ${proxy.proxyCode} 代理（${proxy.reasonZh}）。`,
      );
    }
  }
  for (const code of stats.drawdownOmitted) {
    parts.push(`${code} 走勢不足，未納入組合回撤。`);
  }
  return parts.length > 0 ? parts.join("") : null;
}

export function holdingOneYearPct(points: ChartPoint[]): number | null {
  return periodReturn(points, 1, false);
}

export function holdingFiveYearCagrPct(points: ChartPoint[]): number | null {
  return periodReturn(points, 5, true);
}

export function withDividendYield(
  stats: PortfolioStats,
  items: { weight: number; yieldPct: number | null; method: "ttm" | "annualized" | null }[],
): PortfolioStats {
  let weight = 0;
  let sum = 0;
  let annualizedWeight = 0;
  for (const item of items) {
    if (item.yieldPct == null || item.weight <= 0) continue;
    weight += item.weight;
    sum += item.weight * item.yieldPct;
    if (item.method === "annualized") annualizedWeight += item.weight;
  }
  const dividendYieldPct = weight > 0 ? sum / weight : null;
  const dividendYieldMethod: PortfolioStats["dividendYieldMethod"] =
    dividendYieldPct == null ? null : annualizedWeight / Math.max(weight, 1) >= 0.5 ? "annualized" : "ttm";
  const oneYearTotalPct =
    stats.oneYearPct != null && dividendYieldPct != null
      ? stats.oneYearPct + dividendYieldPct
      : stats.oneYearPct ?? dividendYieldPct;

  const withYield =
    dividendYieldPct == null
      ? { ...stats, dividendYieldPct, dividendYieldMethod, oneYearTotalPct }
      : {
          ...stats,
          dividendYieldPct,
          dividendYieldMethod,
          oneYearTotalPct,
          expectedPct: (stats.oneYearPct ?? 0) + dividendYieldPct,
          expectedHorizon: "1年" as const,
        };

  return {
    ...withYield,
    dividendSource: computeDividendSource({
      yieldPct: dividendYieldPct,
      oneYearPricePct: stats.oneYearPct,
      fiveYearPriceCagrPct: stats.fiveYearCagrPct,
    }),
  };
}
