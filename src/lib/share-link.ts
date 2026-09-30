import { PORTFOLIO_TEMPLATES, type PortfolioId } from "./portfolios";

const FUND_CODE = /^[A-Za-z0-9]{2,8}$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const QUARTER = /^(\d{4})Q([1-4])$/i;

export type ShareHolding = {
  code: string;
  weight: number;
};

export type SharePayload = {
  holdings: ShareHolding[];
  startDate: string;
  quarter: string;
};

export type ShareParseError = {
  error: string;
};

const MAX_HOLDINGS = 12;

export function isSharePayload(value: SharePayload | ShareParseError): value is SharePayload {
  return !("error" in value);
}

export function currentQuarterLabel(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  return `${year}Q${Math.ceil(month / 3)}`;
}

export function parseQuarterLabel(raw: string): { year: number; quarter: number } | null {
  const match = raw.trim().match(QUARTER);
  if (!match) return null;
  return { year: Number(match[1]), quarter: Number(match[2]) };
}

export function formatQuarterZh(label: string): string {
  const parsed = parseQuarterLabel(label);
  if (!parsed) return label;
  return `${parsed.year}年第${parsed.quarter}季`;
}

export function quarterStartTs(label: string): number | null {
  const parsed = parseQuarterLabel(label);
  if (!parsed) return null;
  const month = String((parsed.quarter - 1) * 3 + 1).padStart(2, "0");
  const ts = Date.parse(`${parsed.year}-${month}-01T00:00:00+08:00`);
  return Number.isFinite(ts) ? ts : null;
}

export function quarterEndTs(label: string): number | null {
  const parsed = parseQuarterLabel(label);
  if (!parsed) return null;
  const nextQuarter = parsed.quarter === 4 ? 1 : parsed.quarter + 1;
  const nextYear = parsed.quarter === 4 ? parsed.year + 1 : parsed.year;
  const month = String((nextQuarter - 1) * 3 + 1).padStart(2, "0");
  const ts = Date.parse(`${nextYear}-${month}-01T00:00:00+08:00`);
  return Number.isFinite(ts) ? ts : null;
}

export function normalizeHoldings(raw: ShareHolding[]): ShareHolding[] | null {
  const merged = new Map<string, number>();
  for (const item of raw) {
    const code = item.code.trim().toUpperCase();
    if (!FUND_CODE.test(code)) return null;
    if (!Number.isFinite(item.weight) || item.weight <= 0) return null;
    merged.set(code, (merged.get(code) ?? 0) + item.weight);
  }
  const holdings = [...merged.entries()].map(([code, weight]) => ({
    code,
    weight: Math.round(weight * 10) / 10,
  }));
  if (holdings.length === 0 || holdings.length > MAX_HOLDINGS) return null;
  const sum = holdings.reduce((total, item) => total + item.weight, 0);
  if (sum < 99.4 || sum > 100.6) return null;
  return holdings;
}

export function encodeHoldings(holdings: ShareHolding[]): string {
  return holdings.map((item) => `${item.code}:${item.weight}`).join(",");
}

export function parseHoldingsParam(raw: string): ShareHolding[] | null {
  const parts = raw
    .split(/[,，_]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const holdings: ShareHolding[] = [];
  for (const part of parts) {
    const match = part.match(/^([A-Za-z0-9]{2,8})[:.](\d+(?:\.\d+)?)$/);
    if (!match) return null;
    holdings.push({ code: match[1], weight: Number(match[2]) });
  }
  return normalizeHoldings(holdings);
}

export function validateStartDate(raw: string): string | null {
  const date = raw.trim();
  if (!ISO_DATE.test(date)) return null;
  const ts = Date.parse(`${date}T00:00:00+08:00`);
  return Number.isFinite(ts) ? date : null;
}

export function parseShareSearch(
  input: string | URLSearchParams | Record<string, string | string[] | undefined>,
): SharePayload | ShareParseError {
  const params = toParams(input);
  // Client display names belong in the URL fragment only — ignore if present.
  if (params.has("name") || params.has("n") || params.has("client")) {
    params.delete("name");
    params.delete("n");
    params.delete("client");
  }
  const holdingsRaw = params.get("h") ?? params.get("holdings") ?? "";
  const startRaw = params.get("s") ?? params.get("start") ?? "";
  const quarterRaw = (params.get("q") ?? params.get("quarter") ?? "").trim().toUpperCase();
  const holdings = parseHoldingsParam(holdingsRaw);
  const startDate = validateStartDate(startRaw);
  const quarter = parseQuarterLabel(quarterRaw) ? quarterRaw.replace(/^(\d{4})q/i, "$1Q") : null;
  if (!holdings) return { error: "組合權重無效（需基金代號與比重，合計約 100%）" };
  if (!startDate) return { error: "開始日期無效（請用 YYYY-MM-DD）" };
  if (!quarter) return { error: "季度標籤無效（請用 2026Q3）" };
  return { holdings, startDate, quarter };
}

export function encodeShareSearch(payload: SharePayload): string {
  const holdings = normalizeHoldings(payload.holdings);
  if (!holdings) throw new Error("invalid holdings");
  const startDate = validateStartDate(payload.startDate);
  if (!startDate) throw new Error("invalid start date");
  const quarter = parseQuarterLabel(payload.quarter);
  if (!quarter) throw new Error("invalid quarter");
  const params = new URLSearchParams();
  params.set("h", encodeHoldings(holdings));
  params.set("s", startDate);
  params.set("q", `${quarter.year}Q${quarter.quarter}`);
  return params.toString();
}

export function encodeShareHash(displayName: string): string {
  const name = displayName.trim();
  if (!name) return "";
  return `#n=${encodeURIComponent(name)}`;
}

export function parseShareHash(hash: string): string {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return "";
  const params = new URLSearchParams(raw);
  const named = params.get("n") ?? params.get("name");
  if (named != null) return named.trim();
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

export function buildSharePath(payload: SharePayload, displayName?: string): string {
  const search = encodeShareSearch(payload);
  const hash = displayName?.trim() ? encodeShareHash(displayName) : "";
  return `/share?${search}${hash}`;
}

export function holdingsFromPortfolioId(id: PortfolioId): ShareHolding[] {
  const template = PORTFOLIO_TEMPLATES.find((item) => item.id === id);
  if (!template) return [];
  return template.sleeves.map((sleeve) => ({ code: sleeve.code, weight: sleeve.weight }));
}

function toParams(
  input: string | URLSearchParams | Record<string, string | string[] | undefined>,
): URLSearchParams {
  if (typeof input === "string") {
    const text = input.startsWith("?") ? input.slice(1) : input;
    return new URLSearchParams(text);
  }
  if (input instanceof URLSearchParams) return new URLSearchParams(input.toString());
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value == null) continue;
    params.set(key, Array.isArray(value) ? value[0] ?? "" : value);
  }
  return params;
}
