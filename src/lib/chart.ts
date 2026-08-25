import type { ChartPeriod, ChartPoint } from "./types";

export const CHART_PERIODS: { id: ChartPeriod; label: string; days: number | null }[] = [
  { id: "1M", label: "1個月", days: 31 },
  { id: "3M", label: "3個月", days: 93 },
  { id: "6M", label: "6個月", days: 186 },
  { id: "1Y", label: "1年", days: 366 },
  { id: "5Y", label: "5年", days: 365 * 5 + 2 },
  { id: "All", label: "全部", days: null },
];

const MS_DAY = 86_400_000;

export function sliceChart(points: ChartPoint[], period: ChartPeriod): ChartPoint[] {
  if (points.length === 0) return [];
  const spec = CHART_PERIODS.find((item) => item.id === period);
  if (!spec || spec.days == null) return points;
  const cutoff = points[points.length - 1].t - spec.days * MS_DAY;
  const sliced = points.filter((point) => point.t >= cutoff);
  return sliced.length > 0 ? sliced : points.slice(-2);
}

export function periodStats(points: ChartPoint[]) {
  if (points.length === 0) {
    return { first: 0, last: 0, changePct: 0, min: 0, max: 0, start: 0, end: 0 };
  }
  const first = points[0].price;
  const last = points[points.length - 1].price;
  const prices = points.map((p) => p.price);
  return {
    first,
    last,
    changePct: first === 0 ? 0 : ((last - first) / first) * 100,
    min: Math.min(...prices),
    max: Math.max(...prices),
    start: points[0].t,
    end: points[points.length - 1].t,
  };
}

export function downsample(points: ChartPoint[], maxPoints: number): ChartPoint[] {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  const out: ChartPoint[] = [];
  for (let i = 0; i < maxPoints; i += 1) {
    out.push(points[Math.round(i * step)]);
  }
  return out;
}

/** Keep recent daily points and downsample older history so the RSC payload stays small. */
export function compactChart(points: ChartPoint[], recentDays = 800): ChartPoint[] {
  if (points.length <= 900) return points;
  const cutoff = points[points.length - 1].t - recentDays * MS_DAY;
  const older: ChartPoint[] = [];
  const recent: ChartPoint[] = [];
  for (const point of points) {
    if (point.t >= cutoff) recent.push(point);
    else older.push(point);
  }
  return [...downsample(older, 200), ...recent];
}

export function parseBidNumber(bidPrice: string): number | null {
  const match = bidPrice.replace(/,/g, "").match(/(\d+\.\d+|\d+)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function currencyPrefix(bidPrice: string): string {
  const match = bidPrice.match(/^([^\d.+-]+)/);
  return match ? match[1] : "";
}

export function formatPrice(value: number, digits = 4): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatChartDate(ts: number): string {
  return new Date(ts).toLocaleDateString("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
