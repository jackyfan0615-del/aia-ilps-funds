import { fetchAiaFundChart } from "./aia";
import {
  computePortfolioStats,
  holdingOneYearPct,
  type PortfolioStats,
} from "./portfolio-stats";
import type { Fund } from "./types";

export type PortfolioId = "income" | "steady" | "balanced" | "growth";

export type PortfolioSleeve = {
  code: string;
  weight: number;
  role: string;
};

export type PortfolioTemplate = {
  id: PortfolioId;
  name: string;
  risk: "偏低" | "中等" | "偏高";
  style: "派息" | "增長";
  summary: string;
  principle: string;
  suitedFor: string;
  sleeves: PortfolioSleeve[];
};

export type ResolvedHolding = PortfolioSleeve & {
  fund: Fund | null;
  oneYearPct: number | null;
};

export type ResolvedPortfolio = Omit<PortfolioTemplate, "sleeves"> & {
  holdings: ResolvedHolding[];
  stats: PortfolioStats;
};

export const PORTFOLIO_TEMPLATES: PortfolioTemplate[] = [
  {
    id: "income",
    name: "派息入息",
    risk: "中等",
    style: "派息",
    summary: "以 Z 字派息基金為主，短債打底，再配多元資產與環球高息股票。",
    principle:
      "目標是帳戶有股息流。短債與公司債防守，安聯收益及增長做核心入息，環球高息股票提高派息。代價是淨值會波動，派息不保證。",
    suitedFor: "希望保單帳戶有現金股息、可接受價格波動的客戶。派息不保證，亦可因市況而從本金支付。",
    sleeves: [
      { code: "Z36", weight: 20, role: "短債打底" },
      { code: "Z77", weight: 20, role: "多元收益" },
      { code: "Z29", weight: 15, role: "環球公司債" },
      { code: "Z07", weight: 25, role: "核心入息" },
      { code: "Z17", weight: 20, role: "股票高息" },
    ],
  },
  {
    id: "steady",
    name: "穩健增長",
    risk: "偏低",
    style: "增長",
    summary: "現金與短債降低波動，平衡及動態配置作核心，少量環球股票參與升市。",
    principle:
      "目標是穩中求升、少派息。現金加短債壓波動，平衡／動態配置做核心，約兩成環球股票參與升市。",
    suitedFor: "風險承受較低、年期中長、以累積淨值為主的客戶。",
    sleeves: [
      { code: "W04", weight: 15, role: "美元現金" },
      { code: "W06", weight: 20, role: "短債穩定" },
      { code: "R03", weight: 25, role: "股債平衡" },
      { code: "A32", weight: 20, role: "動態配置" },
      { code: "CG1", weight: 20, role: "環球股票" },
    ],
  },
  {
    id: "balanced",
    name: "均衡核心",
    risk: "中等",
    style: "增長",
    summary: "安聯收益及增長 + 施羅德動力收息作股債混合，配環球股票核心。",
    principle:
      "目標是一籃子完成核心。股債混合約一半，環球加重點股票約四成半，一成短債作緩衝。",
    suitedFor: "可接受中度波動、想一籃子完成核心配置的客戶。",
    sleeves: [
      { code: "W06", weight: 10, role: "短債緩衝" },
      { code: "P07", weight: 25, role: "收益及增長" },
      { code: "J20", weight: 20, role: "動力收息" },
      { code: "CG1", weight: 25, role: "環球股票" },
      { code: "A15", weight: 20, role: "重點股票" },
    ],
  },
  {
    id: "growth",
    name: "進取增長",
    risk: "偏高",
    style: "增長",
    summary: "環球股票為主，加科技與黃金分散，留少量貨幣市場作調倉緩衝。",
    principle:
      "目標是長期資本增值。約九成股票（環球核心、機會型、科技），黃金分散，一成現金方便調倉。",
    suitedFor: "年期較長、能承受較大回撤、目標資本增值的客戶。",
    sleeves: [
      { code: "CG1", weight: 30, role: "環球核心" },
      { code: "N07", weight: 25, role: "機會型股票" },
      { code: "H01", weight: 20, role: "科技增長" },
      { code: "I07", weight: 15, role: "黃金分散" },
      { code: "W04", weight: 10, role: "現金緩衝" },
    ],
  },
];

export async function resolvePortfoliosWithStats(funds: Fund[]): Promise<ResolvedPortfolio[]> {
  const codes = [...new Set(PORTFOLIO_TEMPLATES.flatMap((template) => template.sleeves.map((sleeve) => sleeve.code)))];
  const charts = new Map<string, Awaited<ReturnType<typeof fetchAiaFundChart>>>();
  const results = await Promise.allSettled(codes.map((code) => fetchAiaFundChart(code)));
  results.forEach((result, index) => {
    const code = codes[index];
    charts.set(code, result.status === "fulfilled" ? result.value : []);
  });

  const byCode = new Map(funds.map((fund) => [fund.code, fund]));

  return PORTFOLIO_TEMPLATES.map((template) => {
    const holdings = template.sleeves.map((sleeve) => {
      const points = charts.get(sleeve.code) ?? [];
      return {
        ...sleeve,
        fund: byCode.get(sleeve.code) ?? null,
        oneYearPct: holdingOneYearPct(points),
      };
    });

    return {
      id: template.id,
      name: template.name,
      risk: template.risk,
      style: template.style,
      summary: template.summary,
      principle: template.principle,
      suitedFor: template.suitedFor,
      holdings,
      stats: computePortfolioStats(
        holdings.map((holding) => ({
          weight: holding.weight,
          points: charts.get(holding.code) ?? [],
        })),
      ),
    };
  });
}
