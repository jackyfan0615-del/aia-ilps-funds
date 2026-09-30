import type { ChartPoint } from "./types";

/**
 * A holding is treated as missing the 2022 bear market (and therefore unsafe
 * to start the blended portfolio NAV at) when its first AIA price is after
 * this cutoff. Share-class twins and similar-fund proxies are only used to
 * extend the *risk* series (max drawdown); return metrics still use own prices.
 */
export const RISK_HISTORY_CUTOFF = Date.UTC(2022, 0, 1);

/** Same underlying fund, other share class (accumulation ↔ distribution). */
export const SHARE_CLASS_TWIN: Record<string, string> = {
  W06: "Z36",
  Z36: "W06",
  W07: "Z77",
  Z77: "W07",
  CG9: "Z29",
  Z29: "CG9",
  P07: "Z07",
  Z07: "P07",
  I17: "Z17",
  Z17: "I17",
  J20: "Z20",
  Z20: "J20",
  M10: "Z13",
  Z13: "M10",
  D18: "Z18",
  Z18: "D18",
};

/**
 * Similar AIA ILPS fund used when the share-class twin is also too short.
 * Reasons are Traditional Chinese and shown on the portfolio card.
 */
export const SIMILAR_FUND_PROXY: Record<string, { code: string; reasonZh: string }> = {
  W06: { code: "B01", reasonZh: "同類美元短債" },
  Z36: { code: "B01", reasonZh: "同類美元短債" },
  J20: { code: "R03", reasonZh: "同類股債混合" },
  Z20: { code: "R03", reasonZh: "同類股債混合" },
  Z29: { code: "M11", reasonZh: "同類環球債券" },
  CG9: { code: "M11", reasonZh: "同類環球債券" },
  Z17: { code: "J16", reasonZh: "同類環球高息股票" },
  I17: { code: "J16", reasonZh: "同類環球高息股票" },
  Z13: { code: "R52", reasonZh: "同類美元高收益債" },
  M10: { code: "R52", reasonZh: "同類美元高收益債" },
  Z18: { code: "P07", reasonZh: "同類股債入息" },
  D18: { code: "P07", reasonZh: "同類股債入息" },
};

export type ProxyKind = "share-class" | "similar";

export type PriceProxyUse = {
  proxyCode: string;
  kind: ProxyKind;
  reasonZh: string;
  from: number;
  until: number | null;
};

export type ResolvedRiskSeries = {
  points: ChartPoint[];
  proxy: PriceProxyUse | null;
  omitted: boolean;
};

export function coversRiskWindow(points: ChartPoint[], cutoff = RISK_HISTORY_CUTOFF): boolean {
  return points.length >= 2 && points[0].t <= cutoff;
}

export function proxyCandidateCodes(code: string): string[] {
  const out: string[] = [];
  const twin = SHARE_CLASS_TWIN[code];
  if (twin) out.push(twin);
  const similar = SIMILAR_FUND_PROXY[code];
  if (similar) out.push(similar.code);
  return out;
}

export function allProxyCodes(sleeveCodes: readonly string[]): string[] {
  return [...new Set(sleeveCodes.flatMap((code) => proxyCandidateCodes(code)))];
}

/**
 * Prepend proxy prices from before the holding exists, scaled so the last
 * proxy point before the own series meets the first own price. Own prices
 * are kept verbatim.
 */
export function extendSeriesWithProxy(own: ChartPoint[], proxy: ChartPoint[]): ChartPoint[] {
  if (proxy.length < 2) return own.slice();
  if (own.length < 2) return proxy.slice();

  const ownStart = own[0].t;
  const before = proxy.filter((point) => point.t < ownStart);
  if (before.length === 0 || before[before.length - 1].price <= 0) return own.slice();

  const scale = own[0].price / before[before.length - 1].price;
  if (!Number.isFinite(scale) || scale <= 0) return own.slice();

  return [...before.map((point) => ({ t: point.t, price: point.price * scale })), ...own];
}

type ProxyCandidate = { code: string; kind: ProxyKind; reasonZh: string };

function candidatesFor(code: string): ProxyCandidate[] {
  const out: ProxyCandidate[] = [];
  const twin = SHARE_CLASS_TWIN[code];
  if (twin) {
    out.push({ code: twin, kind: "share-class", reasonZh: "同一基金另一股份類別" });
  }
  const similar = SIMILAR_FUND_PROXY[code];
  if (similar) {
    out.push({ code: similar.code, kind: "similar", reasonZh: similar.reasonZh });
  }
  return out;
}

function asProxyUse(
  own: ChartPoint[],
  extended: ChartPoint[],
  candidate: ProxyCandidate,
): PriceProxyUse {
  return {
    proxyCode: candidate.code,
    kind: candidate.kind,
    reasonZh: candidate.reasonZh,
    from: extended[0].t,
    until: own.length >= 2 ? own[0].t : null,
  };
}

function isLonger(own: ChartPoint[], extended: ChartPoint[]): boolean {
  if (extended.length < 2) return false;
  if (own.length < 2) return true;
  return extended[0].t < own[0].t;
}

/**
 * Pick a price series for portfolio *risk* (drawdown / blended NAV).
 * Preference: own prices if they cover 2022 → share-class twin that covers
 * 2022 → similar fund that covers 2022 → any extension → own → omit.
 */
export function resolveRiskSeries(
  code: string,
  own: ChartPoint[],
  charts: Map<string, ChartPoint[]>,
): ResolvedRiskSeries {
  if (coversRiskWindow(own)) {
    return { points: own, proxy: null, omitted: false };
  }

  const covering: ResolvedRiskSeries[] = [];
  const partial: ResolvedRiskSeries[] = [];

  for (const candidate of candidatesFor(code)) {
    const proxyPoints = charts.get(candidate.code) ?? [];
    const extended = extendSeriesWithProxy(own, proxyPoints);
    if (!isLonger(own, extended)) continue;
    const resolved: ResolvedRiskSeries = {
      points: extended,
      proxy: asProxyUse(own, extended, candidate),
      omitted: false,
    };
    if (coversRiskWindow(extended)) covering.push(resolved);
    else partial.push(resolved);
  }

  if (covering[0]) return covering[0];
  if (partial[0]) return partial[0];
  if (own.length >= 2) return { points: own, proxy: null, omitted: false };
  return { points: [], proxy: null, omitted: true };
}
