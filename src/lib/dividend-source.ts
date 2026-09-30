/**
 * 派息來源：含息總回報 − 股息率。
 *
 * 網站 Z 字走勢是賣出價（不含再投資派息）。近 1 年含息 = 價格變動 + 股息率
 * （與組合頁既有算法相同）。差額即同期淨值／本金變化：負數代表部分派息
 * 實際上來自本金。5 年只用水位價格年化（真實網站數據，不含派息）。
 */

export type DividendSource = {
  yieldPct: number | null;
  oneYearTotalPct: number | null;
  oneYearCapitalPct: number | null;
  fiveYearCapitalPct: number | null;
  /** True when 1y or 5y capital change is clearly negative. */
  fromCapital: boolean;
};

const EROSION_EPS = -0.002;

export function computeDividendSource(input: {
  yieldPct: number | null;
  oneYearPricePct: number | null;
  fiveYearPriceCagrPct?: number | null;
}): DividendSource | null {
  const yieldPct = finiteOrNull(input.yieldPct);
  const oneYearPrice = finiteOrNull(input.oneYearPricePct);
  const fiveYearCapitalPct = finiteOrNull(input.fiveYearPriceCagrPct ?? null);
  if (yieldPct == null && oneYearPrice == null && fiveYearCapitalPct == null) {
    return null;
  }

  const oneYearTotalPct =
    oneYearPrice != null && yieldPct != null
      ? oneYearPrice + yieldPct
      : oneYearPrice ?? (yieldPct != null ? yieldPct : null);
  const oneYearCapitalPct =
    oneYearTotalPct != null && yieldPct != null ? oneYearTotalPct - yieldPct : oneYearPrice;

  const fromCapital =
    (oneYearCapitalPct != null && oneYearCapitalPct < EROSION_EPS) ||
    (fiveYearCapitalPct != null && fiveYearCapitalPct < EROSION_EPS);

  return {
    yieldPct,
    oneYearTotalPct,
    oneYearCapitalPct,
    fiveYearCapitalPct,
    fromCapital,
  };
}

export const DIVIDEND_SOURCE_METHOD_ZH =
  "派息來源 = 含息總回報 − 股息率。近 1 年含息用賣出價變動加股息率（與本頁一致）；5 年用價格年化（Z 字走勢不含派息）。差額為負即同期淨值下跌，部分派息來自本金。派息不保證。";

export const FROM_CAPITAL_LABEL = "部分派息來自本金";

function finiteOrNull(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}
