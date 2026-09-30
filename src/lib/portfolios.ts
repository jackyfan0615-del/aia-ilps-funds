import { fetchAiaFundChart, fetchAiaDividends } from "./aia";
import { parseBidNumber } from "./chart";
import { estimateDividendYield } from "./dividends";
import { computeDividendSource, type DividendSource } from "./dividend-source";
import {
  computePortfolioStats,
  holdingFiveYearCagrPct,
  holdingOneYearPct,
  withDividendYield,
  type PortfolioStats,
} from "./portfolio-stats";
import { allProxyCodes, resolveRiskSeries } from "./price-proxies";
import type { ChartPoint, Fund } from "./types";

/** Max parallel requests to www1.aia.com.hk — AIA's WAF 403s wider bursts. */
const AIA_FETCH_CONCURRENCY = 4;

type Settled<T> = { ok: true; value: T } | { ok: false };

/**
 * Ordered Promise.allSettled that keeps at most `limit` tasks in flight.
 * A throttled fund must never abort the whole portfolio resolve, and must
 * never be silently averaged away — see dataStatus below.
 */
export async function mapWithLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<Settled<R>[]> {
  const results: Settled<R>[] = new Array(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = { ok: true, value: await fn(items[index], index) };
      } catch {
        // AIA throttled the request or the payload failed validation —
        // recorded as a failure, never as an empty "no data" series.
        results[index] = { ok: false };
      }
    }
  }
  const workers = Array.from(
    { length: Math.min(Math.max(limit, 1), Math.max(items.length, 1)) },
    worker,
  );
  await Promise.all(workers);
  return results;
}

export type PortfolioId = "income" | "steady" | "balanced" | "growth";

export type PortfolioSleeve = {
  code: string;
  weight: number;
  role: string;
};

export type MixSleeve = {
  code: string;
  weight: number;
  role?: string;
};

export type PortfolioTemplate = {
  id: PortfolioId;
  name: string;
  risk: "偏低" | "中等" | "偏高";
  style: "派息" | "增長";
  summary: string;
  principle: string;
  suitedFor: string;
  whySleeves: string;
  alternatives: string;
  meetingRisk: string;
  sleeves: PortfolioSleeve[];
};

export type ResolvedHolding = PortfolioSleeve & {
  fund: Fund | null;
  oneYearPct: number | null;
  fiveYearCagrPct: number | null;
  dividendYieldPct: number | null;
  dividendSource: DividendSource | null;
};

export type PortfolioDataStatus = "ok" | "provisional";

/**
 * Pure provisional decision: any failed fetch, or coverage too thin to trust
 * the blended numbers. Extracted so it can be unit-tested without network.
 */
export function resolveDataStatus(failedCodes: string[], coverage: number): PortfolioDataStatus {
  return failedCodes.length > 0 || coverage < 0.6 ? "provisional" : "ok";
}

export type ResolvedPortfolio = Omit<PortfolioTemplate, "sleeves"> & {
  holdings: ResolvedHolding[];
  stats: PortfolioStats;
  /**
   * "provisional" when any holding's chart/dividend data failed to load (AIA
   * throttling etc.) or coverage is too thin — the numbers are partial and the
   * UI must say 數據更新中 instead of presenting a confident projection.
   */
  dataStatus: PortfolioDataStatus;
  failedCodes: string[];
};

export const PORTFOLIO_TEMPLATES: PortfolioTemplate[] = [
  {
    id: "income",
    name: "派息入息",
    risk: "中等",
    style: "派息",
    summary: "以 Z 字派息基金為主，短債打底，富蘭克林入息做核心，再配高收益債與環球高息股票。",
    principle:
      "目標是帳戶有股息流。短債防守，富蘭克林入息做核心入息，美元高收益與安聯收益及增長補收益，環球高息股票提高派息。代價是淨值會波動，派息不保證。",
    suitedFor: "希望保單帳戶有現金股息、可接受價格波動的客戶。派息不保證，亦可因市況而從本金支付。",
    whySleeves:
      "帳戶要現金股息才用 Z 字。Z18 富蘭克林入息做核心，Z36 短債打底，Z13 美元高收益與 Z07 安聯收益及增長補入息，Z17 環球高息股票提高派息。J16 施羅德環球收益股票是累積類別，保單戶口不會派現金，不要用它替代 Z17。請對照派息來源：含息總回報低於股息率即部分派息來自本金。",
    alternatives:
      "首 5 年手續費約 2.4% 會吃薄短債息；可略減 Z36、提高 Z18／Z17。第 6 年才把防守債加回。不要用 J16 或其他累積類別替代 Z 字。",
    meetingRisk: "淨值會波動，派息不保證，亦可從本金支付。",
    sleeves: [
      { code: "Z36", weight: 25, role: "短債打底" },
      { code: "Z13", weight: 10, role: "美元高收益" },
      { code: "Z18", weight: 30, role: "核心入息" },
      { code: "Z07", weight: 10, role: "收益及增長" },
      { code: "Z17", weight: 25, role: "股票高息" },
    ],
  },
  {
    id: "steady",
    name: "穩健增長",
    risk: "偏低",
    style: "增長",
    summary: "現金與短債約三成壓波動，駿利平衡作核心，亞太入息與環球收益股票參與升市。",
    principle:
      "目標是穩中求升、少派息。現金加短債約 30% 壓波動，股債平衡做核心，亞太入息與環球收益股票各約四分一。",
    suitedFor: "風險承受較低、年期中長、以累積淨值為主的客戶。不是保本，股市大跌時仍會回撤。",
    whySleeves:
      "F14 摩根亞太入息（累積）取代舊 A32：5 年價格與 2022 年抗跌較好。J16 施羅德環球收益股票（累積）取代舊 CG1：2022 年回撤明顯較細，風格偏價值／收息，美股科技大升年會跑輸。現金 W04 + 短債 W06 減至 30%，因首 5 年約 2.38% 手續費會吃薄貨幣／短債淨回報。",
    alternatives:
      "若要加歐洲股票，改用均衡核心（F11），不要在穩健裡疊歐洲。科技主導年可略增股票核心，但不要把 J16 當成派息 Z 字。",
    meetingRisk: "首 5 年現金／短債扣費後淨回報偏薄；股市大跌時仍會回撤，不是保本。",
    sleeves: [
      { code: "W04", weight: 15, role: "美元現金" },
      { code: "W06", weight: 15, role: "短債穩定" },
      { code: "R03", weight: 20, role: "股債平衡" },
      { code: "F14", weight: 25, role: "亞太入息" },
      { code: "J16", weight: 25, role: "環球收益股票" },
    ],
  },
  {
    id: "balanced",
    name: "均衡核心",
    risk: "中等",
    style: "增長",
    summary: "與穩健共用平衡及亞太／環球收益股票，把現金換成歐洲股票，短債作緩衝。",
    principle:
      "目標是一籃子完成核心。駿利平衡、亞太入息與環球收益股票約六成半，歐洲股票約四分一，一成短債作緩衝。",
    suitedFor: "可接受中度波動、想一籃子完成核心配置的客戶。",
    whySleeves:
      "與穩健共用 R03、F14、J16，但以 F11 摩根歐洲動力（美元對沖）取代現金，補歐洲股票、地域更均衡。W06 一成短債作緩衝。F11 是歐洲股票不是第二隻環球核心；不要把它當成 CG1。",
    alternatives:
      "不要再疊 H01 或 CG1，歐洲／環球股票會過重。能源 I09（油氣）與 T09（潔淨能源）二選一當主題，不要兩隻都加。想再防守請改用穩健增長（含 W04 現金）。",
    meetingRisk: "中度波動，歐洲股票約四分一，不是保本。過往表現不代表將來表現。",
    sleeves: [
      { code: "W06", weight: 10, role: "短債緩衝" },
      { code: "R03", weight: 20, role: "股債平衡" },
      { code: "F14", weight: 20, role: "亞太入息" },
      { code: "J16", weight: 25, role: "環球收益股票" },
      { code: "F11", weight: 25, role: "歐洲股票" },
    ],
  },
  {
    id: "growth",
    name: "進取增長",
    risk: "偏高",
    style: "增長",
    summary: "環球股票為主，加科技與黃金分散，配環球收益股票，留少量貨幣市場作調倉緩衝。",
    principle:
      "目標是長期資本增值。約九成股票（環球核心、科技、環球收益股票），黃金分散，一成現金方便調倉。",
    suitedFor: "年期較長、能承受較大回撤、目標資本增值的客戶。",
    whySleeves:
      "CG1 做環球核心，H01 是科技，J16 施羅德環球收益股票偏價值／收息作衛星。黃金用 I07（大型金礦）而非 D14（貴金屬／中小型礦股），角色是分散不是追礦股。H01 不是 QQQ：主動環球科技，這張保單買不到納指 ETF。",
    alternatives:
      "不要再疊歐洲或集中股票主題，與 CG1／H01 同向會過重。能源 I09／T09 不要用來替代 I07。現金 W04 可留作調倉。不要把 J16 當成派息 Z 字。",
    meetingRisk: "年期要長，須能接受科技與環球股票約三成至五成回撤。",
    sleeves: [
      { code: "W04", weight: 10, role: "現金緩衝" },
      { code: "CG1", weight: 30, role: "環球核心" },
      { code: "J16", weight: 20, role: "環球收益股票" },
      { code: "H01", weight: 25, role: "科技增長" },
      { code: "I07", weight: 15, role: "黃金分散" },
    ],
  },
];

/**
 * Previous published mixes. Share links encode holdings in the URL, so old
 * `h=` queries must still resolve to the named template (style / roles).
 */
const LEGACY_SLEEVE_SETS: { id: PortfolioId; sleeves: MixSleeve[] }[] = [
  {
    id: "income",
    sleeves: [
      { code: "Z36", weight: 20 },
      { code: "Z77", weight: 20 },
      { code: "Z29", weight: 15 },
      { code: "Z07", weight: 25 },
      { code: "Z17", weight: 20 },
    ],
  },
  {
    id: "balanced",
    sleeves: [
      { code: "W06", weight: 10 },
      { code: "P07", weight: 25 },
      { code: "J20", weight: 20 },
      { code: "CG1", weight: 25 },
      { code: "A15", weight: 20 },
    ],
  },
  {
    id: "growth",
    sleeves: [
      { code: "CG1", weight: 30 },
      { code: "N07", weight: 25 },
      { code: "H01", weight: 20 },
      { code: "I07", weight: 15 },
      { code: "W04", weight: 10 },
    ],
  },
];

function mixKey(sleeves: MixSleeve[]): string {
  return [...sleeves]
    .map((sleeve) => `${sleeve.code.trim().toUpperCase()}:${Math.round(sleeve.weight * 10) / 10}`)
    .sort()
    .join("|");
}

export function matchMixTemplate(sleeves: MixSleeve[]): PortfolioTemplate | null {
  const needle = mixKey(sleeves);
  if (!needle) return null;
  const current = PORTFOLIO_TEMPLATES.find((template) => mixKey(template.sleeves) === needle);
  if (current) return current;
  const legacy = LEGACY_SLEEVE_SETS.find((item) => mixKey(item.sleeves) === needle);
  if (!legacy) return null;
  return PORTFOLIO_TEMPLATES.find((template) => template.id === legacy.id) ?? null;
}

export async function resolvePortfoliosWithStats(funds: Fund[]): Promise<ResolvedPortfolio[]> {
  const codes = [...new Set(PORTFOLIO_TEMPLATES.flatMap((template) => template.sleeves.map((sleeve) => sleeve.code)))];
  const sleeveSet = new Set(codes);
  const extraProxyCodes = allProxyCodes(codes).filter((code) => !sleeveSet.has(code));
  const chartCodes = [...codes, ...extraProxyCodes];
  const incomeCodes = [
    ...new Set(
      PORTFOLIO_TEMPLATES.filter((template) => template.style === "派息").flatMap((template) =>
        template.sleeves.map((sleeve) => sleeve.code),
      ),
    ),
  ];
  const charts = new Map<string, ChartPoint[]>();
  const yields = new Map<string, ReturnType<typeof estimateDividendYield>>();
  const failedChartCodes = new Set<string>();
  const failedDividendCodes = new Set<string>();
  const [chartResults, dividendResults] = await Promise.all([
    mapWithLimit(chartCodes, AIA_FETCH_CONCURRENCY, (code) => fetchAiaFundChart(code)),
    mapWithLimit(incomeCodes, AIA_FETCH_CONCURRENCY, (code) => fetchAiaDividends(code)),
  ]);
  chartResults.forEach((result, index) => {
    const code = chartCodes[index];
    if (result.ok) {
      charts.set(code, result.value);
    } else {
      charts.set(code, []);
      if (sleeveSet.has(code)) failedChartCodes.add(code);
    }
  });
  const byCode = new Map(funds.map((fund) => [fund.code, fund]));
  dividendResults.forEach((result, index) => {
    const code = incomeCodes[index];
    if (result.ok) {
      const bid = parseBidNumber(byCode.get(code)?.bidPrice || "");
      yields.set(code, bid ? estimateDividendYield(result.value, bid) : null);
    } else {
      yields.set(code, null);
      failedDividendCodes.add(code);
    }
  });

  return PORTFOLIO_TEMPLATES.map((template) => {
    const holdings = template.sleeves.map((sleeve) => {
      const points = charts.get(sleeve.code) ?? [];
      const oneYearPct = holdingOneYearPct(points);
      const fiveYearCagrPct = holdingFiveYearCagrPct(points);
      const dividendYieldPct = yields.get(sleeve.code)?.pct ?? null;
      return {
        ...sleeve,
        fund: byCode.get(sleeve.code) ?? null,
        oneYearPct,
        fiveYearCagrPct,
        dividendYieldPct,
        dividendSource:
          template.style === "派息"
            ? computeDividendSource({
                yieldPct: dividendYieldPct,
                oneYearPricePct: oneYearPct,
                fiveYearPriceCagrPct: fiveYearCagrPct,
              })
            : null,
      };
    });

    let stats = computePortfolioStats(
      holdings.map((holding) => {
        const points = charts.get(holding.code) ?? [];
        const risk = resolveRiskSeries(holding.code, points, charts);
        return {
          code: holding.code,
          weight: holding.weight,
          points,
          riskPoints: risk.points,
          drawdownProxy: risk.proxy,
          omittedFromDrawdown: risk.omitted,
        };
      }),
    );
    if (template.style === "派息") {
      stats = withDividendYield(
        stats,
        holdings.map((holding) => ({
          weight: holding.weight,
          yieldPct: holding.dividendYieldPct,
          method: yields.get(holding.code)?.method ?? null,
        })),
      );
    }

    const failedCodes = template.sleeves
      .map((sleeve) => sleeve.code)
      .filter(
        (code) =>
          failedChartCodes.has(code) ||
          (template.style === "派息" && failedDividendCodes.has(code)),
      );
    const dataStatus = resolveDataStatus(failedCodes, stats.coverage);

    return {
      id: template.id,
      name: template.name,
      risk: template.risk,
      style: template.style,
      summary: template.summary,
      principle: template.principle,
      suitedFor: template.suitedFor,
      whySleeves: template.whySleeves,
      alternatives: template.alternatives,
      meetingRisk: template.meetingRisk,
      holdings,
      stats,
      dataStatus,
      failedCodes,
    };
  });
}
