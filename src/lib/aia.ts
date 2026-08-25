import type { Fund, FundType, FundsDataset } from "./types";

const AIA_FUND_INFO_URL =
  "https://www1.aia.com.hk/CorpWS/Investment/Get/FundInfo2/?fund_cat=TMP2&fund_type=&fund_house=&fund_code=&name=&lang=zh";

export const AIA_SOURCE_PAGE =
  "https://www.aia.com.hk/zh-hk/help-and-support/individuals/investment-information/investment-options-prices.html";

export const FUNDS_CACHE_TAG = "aia-funds";

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
    headers: {
      Accept: "application/json,text/plain,*/*",
      "User-Agent":
        "Mozilla/5.0 (compatible; AIA-ILPS-Funds/1.0; +https://aia-ilps-funds.vercel.app)",
    },
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
