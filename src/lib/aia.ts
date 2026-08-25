import type { ChartPoint, Fund, FundExtras, FundType, FundsDataset, YearReturn } from "./types";

const AIA_FUND_INFO_URL =
  "https://www1.aia.com.hk/CorpWS/Investment/Get/FundInfo2/?fund_cat=TMP2&fund_type=&fund_house=&fund_code=&name=&lang=zh";

export const AIA_SOURCE_PAGE =
  "https://www.aia.com.hk/zh-hk/help-and-support/individuals/investment-information/investment-options-prices.html";

export const FUNDS_CACHE_TAG = "aia-funds";
export const CHART_CACHE_TAG = "aia-fund-charts";

const AIA_HEADERS = {
  Accept: "application/json,text/plain,*/*",
  "User-Agent":
    "Mozilla/5.0 (compatible; AIA-ILPS-Funds/1.0; +https://aia-ilps-funds.vercel.app)",
};

export function aiaDetailsUrl(code: string): string {
  return `https://www.aia.com.hk/zh-hk/help-and-support/individuals/investment-information/investment-options-prices/details.html?id=${encodeURIComponent(code)}&cat=TMP2&lang=zh`;
}

type AiaFundRaw = {
  cat: string;
  code: string;
  name: string;
  risk: string;
  rating?: number;
  currency?: string;
  bidPrice?: string;
  offerPrice?: string;
  valuationDate?: string;
  house?: string;
  type?: string;
  fund_scheme?: string;
  fund_size?: string;
  distribution_fund?: string;
};

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePrice(value: string | undefined): string {
  if (!value) return "";
  const cleaned = stripHtml(value)
    .replace(/[▲▼►]/g, "")
    .replace(/\s+/g, "");
  return cleaned.replace(/\[([^\]]+)\]/g, "$1");
}

function parseDate(value: string | undefined): string {
  if (!value) return "";
  return stripHtml(value).replace(/[\[\]]/g, "");
}

function parseStars(rating: number | undefined): string {
  if (!rating || rating <= 0) return "";
  return "★".repeat(Math.min(rating, 5));
}

function mapFund(raw: AiaFundRaw): Fund {
  const name = stripHtml(raw.name || "");
  let resolvedType: FundType = "growth";
  if (raw.code.startsWith("Z") || raw.distribution_fund === "Y") {
    resolvedType = "dividend";
  } else if (/[（(]分派[）)]/.test(name)) {
    resolvedType = "other_dividend";
  }

  const currency = raw.currency || "美元";
  const size = (raw.fund_size || "").trim();

  return {
    code: raw.code,
    name,
    risk: raw.risk || "",
    bidPrice: parsePrice(raw.bidPrice),
    offerPrice: parsePrice(raw.offerPrice),
    valuationDate: parseDate(raw.valuationDate),
    morningstar: parseStars(raw.rating),
    type: resolvedType,
    manager: (raw.house || "").trim(),
    assetClass: (raw.type || "").trim(),
    aum: size ? `${currency}${size}` : "",
  };
}

export function toDataset(rawFunds: AiaFundRaw[], scrapedAt = new Date().toISOString()): FundsDataset {
  const funds = rawFunds
    .filter((f) => f.code && f.name)
    .map(mapFund)
    .sort((a, b) => a.code.localeCompare(b.code));

  const growth = funds.filter((f) => f.type === "growth").length;
  const dividend = funds.filter((f) => f.type === "dividend").length;
  const other = funds.filter((f) => f.type === "other_dividend").length;
  const product = rawFunds[0]?.fund_scheme || "「卓達智悅 2」";

  return {
    product,
    source: AIA_SOURCE_PAGE,
    scrapedAt,
    counts: {
      total: funds.length,
      growth,
      dividend,
      other,
    },
    funds,
  };
}

export async function fetchAiaFunds(fresh = false): Promise<FundsDataset> {
  const res = await fetch(AIA_FUND_INFO_URL, {
    headers: AIA_HEADERS,
    ...(fresh
      ? { cache: "no-store" as const }
      : { next: { revalidate: 21600, tags: [FUNDS_CACHE_TAG] } }),
  });

  if (!res.ok) {
    throw new Error(`AIA FundInfo2 failed: ${res.status}`);
  }

  const raw = (await res.json()) as AiaFundRaw[];
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("AIA FundInfo2 returned empty data");
  }

  return toDataset(raw);
}

type AiaYearRow = {
  year?: string;
  price?: string;
};

type AiaFundDetailRaw = AiaFundRaw & {
  ISIN?: string;
  dd_change?: string;
  performance_as_of?: string;
  priceHistory?: AiaYearRow[];
};

function parseYearReturns(rows: AiaYearRow[] | undefined): YearReturn[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const year = (row.year || "").trim();
      const value = stripHtml(row.price || "");
      if (!year || !value) return null;
      return {
        year,
        value,
        negative: value.startsWith("-"),
      };
    })
    .filter((row): row is YearReturn => row !== null);
}

export async function fetchAiaFundChart(code: string): Promise<ChartPoint[]> {
  const url = `https://www1.aia.com.hk/CorpWS/Investment/Get/FundChart/?fund_code=${encodeURIComponent(code)}&fund_cat=TMP2`;
  const res = await fetch(url, {
    headers: AIA_HEADERS,
    next: { revalidate: 21600, tags: [CHART_CACHE_TAG] },
  });

  if (!res.ok) {
    throw new Error(`AIA FundChart failed: ${res.status}`);
  }

  const text = await res.text();
  const raw = JSON.parse(text) as unknown;
  if (!Array.isArray(raw)) return [];

  const points: ChartPoint[] = [];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const t = Number(row[0]);
    const price = Number(row[1]);
    if (!Number.isFinite(t) || !Number.isFinite(price)) continue;
    points.push({ t, price });
  }
  return points;
}

export async function fetchAiaFundExtras(code: string): Promise<FundExtras> {
  const url = `https://www1.aia.com.hk/CorpWS/Investment/Get/FundInfo2/?fund_cat=TMP2&fund_type=&fund_house=&fund_code=${encodeURIComponent(code)}&name=&lang=zh`;
  const res = await fetch(url, {
    headers: AIA_HEADERS,
    next: { revalidate: 21600, tags: [FUNDS_CACHE_TAG] },
  });

  if (!res.ok) {
    throw new Error(`AIA FundInfo2 detail failed: ${res.status}`);
  }

  const raw = (await res.json()) as AiaFundDetailRaw[];
  const fund = Array.isArray(raw) ? raw[0] : undefined;
  if (!fund) {
    return { isin: "", dailyChange: "", performanceAsOf: "", yearReturns: [] };
  }

  return {
    isin: (fund.ISIN || "").trim(),
    dailyChange: stripHtml(fund.dd_change || ""),
    performanceAsOf: parseDate(fund.performance_as_of),
    yearReturns: parseYearReturns(fund.priceHistory),
  };
}
