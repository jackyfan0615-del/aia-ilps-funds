import { compactChart, parseBidNumber } from "./chart";
import { INVESTMENT_DISCLAIMER_ZH } from "./insights-content";
import { POLICY_FEE_EARLY, POLICY_FEE_LATER } from "./policy-fees";
import {
  computePortfolioStats,
  formatSignedPct,
  holdingFiveYearCagrPct,
  holdingOneYearPct,
  withDividendYield,
  type PortfolioStats,
} from "./portfolio-stats";
import {
  mapWithLimit,
  matchMixTemplate,
  resolveDataStatus,
  type MixSleeve,
  type PortfolioDataStatus,
  type ResolvedHolding,
} from "./portfolios";
import { expectedReturnSince, navSince } from "./review";
import {
  formatQuarterZh,
  quarterEndTs,
  quarterStartTs,
  type ShareHolding,
} from "./share-link";
import { fetchAiaDividends, fetchAiaFundChart } from "./aia";
import { computeDividendSource } from "./dividend-source";
import { estimateDividendYield } from "./dividends";
import type { ChartPoint, Fund } from "./types";

const AIA_FETCH_CONCURRENCY = 4;

export type ShareHoldingRow = {
  code: string;
  name: string;
  weight: number;
  sinceStartPct: number | null;
  quarterPct: number | null;
  found: boolean;
};

export type ShareReport = {
  mixName: string;
  style: "派息" | "增長";
  quarter: string;
  quarterLabelZh: string;
  startDate: string;
  asOfLabel: string;
  sinceStartPct: number | null;
  quarterPct: number | null;
  afterFeePct: number | null;
  afterFeeNote: string;
  currentDrawdownPct: number | null;
  holdings: ShareHoldingRow[];
  historyLimited: boolean;
  dataProvisional: boolean;
  failedCodes: string[];
  latestMarket: { title: string; date: string; href: string } | null;
  disclaimer: string;
};

export type MixSeries = {
  name: string;
  style: "派息" | "增長";
  holdings: ResolvedHolding[];
  stats: PortfolioStats;
  dataStatus: PortfolioDataStatus;
  failedCodes: string[];
  charts: Record<string, ChartPoint[]>;
};

function clipPoints(points: ChartPoint[], endTs: number): ChartPoint[] {
  return points.filter((point) => point.t <= endTs);
}

function periodPct(points: ChartPoint[], startTs: number, endTs: number): number | null {
  const clipped = clipPoints(points, endTs);
  return navSince(clipped, startTs).actualPct;
}

export function buildShareReport(input: {
  mix: MixSeries;
  startDate: string;
  quarter: string;
  latestMarket: { title: string; date: string; href: string } | null;
  asOf?: number;
}): ShareReport {
  const asOf = input.asOf ?? Date.now();
  const startTs = Date.parse(`${input.startDate}T00:00:00+08:00`);
  const qStart = quarterStartTs(input.quarter);
  const qEnd = quarterEndTs(input.quarter);
  const nav = input.mix.stats.navPoints;
  const since = Number.isFinite(startTs) ? navSince(nav, startTs) : navSince([], 0);
  const quarterWindowStart =
    qStart != null && Number.isFinite(startTs) ? Math.max(qStart, startTs) : (qStart ?? startTs);
  const quarterEnd = qEnd != null ? Math.min(asOf, qEnd - 1) : asOf;
  const quarterPct =
    qStart != null ? periodPct(nav, quarterWindowStart, quarterEnd) : null;
  const yearsElapsed =
    Number.isFinite(startTs) && asOf > startTs ? (asOf - startTs) / (365.25 * 86_400_000) : 0;
  const afterFeePct = expectedReturnSince(yearsElapsed, input.mix.stats.expectedPct);

  const holdings = input.mix.holdings.map((holding) => {
    const points = input.mix.charts[holding.code] ?? [];
    return {
      code: holding.code,
      name: holding.fund?.name ?? "此代號目前不在目錄",
      weight: holding.weight,
      sinceStartPct: Number.isFinite(startTs) ? periodPct(points, startTs, asOf) : null,
      quarterPct: qStart != null ? periodPct(points, quarterWindowStart, quarterEnd) : null,
      found: holding.fund != null,
    };
  });

  const asOfTs = input.mix.stats.asOf ?? since.to ?? asOf;
  const asOfLabel = new Date(asOfTs).toLocaleDateString("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return {
    mixName: input.mix.name,
    style: input.mix.style,
    quarter: input.quarter,
    quarterLabelZh: formatQuarterZh(input.quarter),
    startDate: input.startDate,
    asOfLabel,
    sinceStartPct: since.actualPct,
    quarterPct,
    afterFeePct,
    afterFeeNote: `按${input.mix.stats.expectedHorizon} ${formatSignedPct(input.mix.stats.expectedPct)}，減首 5 年 ${(POLICY_FEE_EARLY * 100).toFixed(2)}%／其後 ${(POLICY_FEE_LATER * 100).toFixed(2)}% 手續費`,
    currentDrawdownPct: since.currentDrawdownPct,
    holdings,
    historyLimited: since.historyLimited,
    dataProvisional: input.mix.dataStatus === "provisional",
    failedCodes: input.mix.failedCodes,
    latestMarket: input.latestMarket,
    disclaimer: INVESTMENT_DISCLAIMER_ZH,
  };
}

export async function resolveMixSeries(funds: Fund[], sleeves: MixSleeve[]): Promise<MixSeries> {
  const template = matchMixTemplate(sleeves);
  const byCode = new Map(funds.map((fund) => [fund.code.toUpperCase(), fund]));
  const codes = [...new Set(sleeves.map((sleeve) => sleeve.code.trim().toUpperCase()))];
  const dividendCodes = codes.filter((code) => {
    const fund = byCode.get(code);
    return fund?.type === "dividend" || fund?.type === "other_dividend" || template?.style === "派息";
  });
  const charts = new Map<string, ChartPoint[]>();
  const yields = new Map<string, ReturnType<typeof estimateDividendYield>>();
  const failedChartCodes = new Set<string>();
  const failedDividendCodes = new Set<string>();
  const [chartResults, dividendResults] = await Promise.all([
    mapWithLimit(codes, AIA_FETCH_CONCURRENCY, (code) => fetchAiaFundChart(code)),
    mapWithLimit(dividendCodes, AIA_FETCH_CONCURRENCY, (code) => fetchAiaDividends(code)),
  ]);
  chartResults.forEach((result, index) => {
    const code = codes[index];
    if (result.ok) charts.set(code, result.value);
    else {
      charts.set(code, []);
      failedChartCodes.add(code);
    }
  });
  dividendResults.forEach((result, index) => {
    const code = dividendCodes[index];
    if (result.ok) {
      const bid = parseBidNumber(byCode.get(code)?.bidPrice || "");
      yields.set(code, bid ? estimateDividendYield(result.value, bid) : null);
    } else {
      yields.set(code, null);
      failedDividendCodes.add(code);
    }
  });

  const style: "派息" | "增長" = template?.style ?? inferStyle(sleeves, byCode);
  const holdings: ResolvedHolding[] = sleeves.map((sleeve) => {
    const code = sleeve.code.trim().toUpperCase();
    const points = charts.get(code) ?? [];
    const oneYearPct = holdingOneYearPct(points);
    const fiveYearCagrPct = holdingFiveYearCagrPct(points);
    const dividendYieldPct = yields.get(code)?.pct ?? null;
    const role =
      sleeve.role ??
      template?.sleeves.find((item) => item.code.toUpperCase() === code)?.role ??
      "配置";
    return {
      code,
      weight: sleeve.weight,
      role,
      fund: byCode.get(code) ?? null,
      oneYearPct,
      fiveYearCagrPct,
      dividendYieldPct,
      dividendSource:
        style === "派息"
          ? computeDividendSource({
              yieldPct: dividendYieldPct,
              oneYearPricePct: oneYearPct,
              fiveYearPriceCagrPct: fiveYearCagrPct,
            })
          : null,
    };
  });

  let stats = computePortfolioStats(
    holdings.map((holding) => ({
      code: holding.code,
      weight: holding.weight,
      points: charts.get(holding.code) ?? [],
    })),
  );
  if (style === "派息") {
    stats = withDividendYield(
      stats,
      holdings.map((holding) => ({
        weight: holding.weight,
        yieldPct: holding.dividendYieldPct,
        method: yields.get(holding.code)?.method ?? null,
      })),
    );
  }

  const failedCodes = codes.filter(
    (code) => failedChartCodes.has(code) || (style === "派息" && failedDividendCodes.has(code)),
  );
  const chartRecord: Record<string, ChartPoint[]> = {};
  for (const code of codes) {
    chartRecord[code] = compactChart(charts.get(code) ?? []);
  }

  return {
    name: template?.name ?? "自選組合",
    style,
    holdings,
    stats,
    dataStatus: resolveDataStatus(failedCodes, stats.coverage),
    failedCodes,
    charts: chartRecord,
  };
}

function inferStyle(sleeves: ShareHolding[], byCode: Map<string, Fund>): "派息" | "增長" {
  let dividendWeight = 0;
  let total = 0;
  for (const sleeve of sleeves) {
    total += sleeve.weight;
    const fund = byCode.get(sleeve.code.toUpperCase());
    if (fund?.type === "dividend" || fund?.type === "other_dividend") dividendWeight += sleeve.weight;
  }
  return total > 0 && dividendWeight / total >= 0.5 ? "派息" : "增長";
}

export function fundMetricsFromPoints(
  points: ChartPoint[],
  yieldPct: number | null,
  yieldMethod: "ttm" | "annualized" | null,
): PortfolioStats {
  const stats = computePortfolioStats([{ code: "fund", weight: 100, points }]);
  if (yieldPct == null) return stats;
  return withDividendYield(stats, [{ weight: 100, yieldPct, method: yieldMethod }]);
}
