import { afterPolicyFee, POLICY_FEE_EARLY, POLICY_FEE_LATER } from "./policy-fees";
import { projectValueExact } from "./growth-projection";
import type { PortfolioId, ResolvedPortfolio } from "./portfolios";
import type { ChartPoint } from "./types";

const MS_DAY = 86_400_000;
const MS_YEAR = 365.25 * MS_DAY;
const STALE_MS = 21 * MS_DAY;

export type ReviewAction = "stay" | "rebalance" | "switch";

export type ReviewAdvice = {
  action: ReviewAction;
  headline: string;
  detail: string;
};

export type ReviewSnapshot = {
  yearsElapsed: number;
  actualPct: number | null;
  expectedPct: number | null;
  currentDrawdownPct: number | null;
  navFrom: number | null;
  navTo: number | null;
  historyLimited: boolean;
  removedCodes: string[];
  staleCodes: string[];
  dataProvisional: boolean;
  advice: ReviewAdvice;
};

export function yearsBetween(startTs: number, endTs: number): number {
  return (endTs - startTs) / MS_YEAR;
}

export function navSince(
  points: ChartPoint[],
  startTs: number,
): {
  actualPct: number | null;
  currentDrawdownPct: number | null;
  from: number | null;
  to: number | null;
  historyLimited: boolean;
} {
  if (points.length < 2) {
    return {
      actualPct: null,
      currentDrawdownPct: null,
      from: null,
      to: null,
      historyLimited: true,
    };
  }

  let first = points[0];
  for (const point of points) {
    if (point.t >= startTs) {
      first = point;
      break;
    }
    first = point;
  }
  const last = points[points.length - 1];
  const window = points.filter((point) => point.t >= first.t);
  const actualPct =
    first.price > 0 && last.price > 0 && last.t > first.t ? last.price / first.price - 1 : null;

  let peak = first.price;
  let worst = 0;
  for (const point of window) {
    if (point.price > peak) peak = point.price;
    if (peak > 0) {
      const drawdown = point.price / peak - 1;
      if (drawdown < worst) worst = drawdown;
    }
  }

  return {
    actualPct,
    currentDrawdownPct: window.length >= 2 ? worst : null,
    from: first.t,
    to: last.t,
    historyLimited: first.t > startTs + 60 * MS_DAY,
  };
}

export function expectedReturnSince(
  yearsElapsed: number,
  gross: number | null,
): number | null {
  if (yearsElapsed <= 0) return null;
  const projected = projectValueExact(
    1,
    Math.min(yearsElapsed, 50),
    afterPolicyFee(gross, POLICY_FEE_EARLY),
    afterPolicyFee(gross, POLICY_FEE_LATER),
  );
  return projected == null ? null : projected - 1;
}

export function suggestReviewTalkingPoint(input: {
  actualPct: number | null;
  expectedPct: number | null;
  currentDrawdownPct: number | null;
  yearsElapsed: number;
  removedCodes: string[];
  staleCodes: string[];
  dataProvisional: boolean;
}): ReviewAdvice {
  if (input.removedCodes.length > 0) {
    return {
      action: "rebalance",
      headline: "有成分已不在 AIA 目錄，先講轉換",
      detail: `以下代號已下架或暫停：${input.removedCodes.join("、")}。週年應先決定替代基金，不要當原組合仍完整。`,
    };
  }

  if (input.dataProvisional || input.staleCodes.length > 0) {
    const stale =
      input.staleCodes.length > 0 ? `數據偏舊或缺失：${input.staleCodes.join("、")}。` : "部分走勢未能更新。";
    return {
      action: "stay",
      headline: "數據未齊，先不要急於轉倉",
      detail: `${stale}向客人說明數字是內部參考，等目錄／價格齊再覆核。`,
    };
  }

  const dd = input.currentDrawdownPct;
  if (dd != null && dd <= -0.15) {
    return {
      action: "stay",
      headline: "現正回撤，先不要在低位賣出",
      detail: "組合距離期內高位仍深。若年期同風險承受沒變，週年主題是拿得住、檢視是否要再平衡，而不是止蝕離場。",
    };
  }

  if (
    input.actualPct != null &&
    input.expectedPct != null &&
    input.yearsElapsed >= 1 &&
    input.actualPct < input.expectedPct - 0.04 * input.yearsElapsed
  ) {
    return {
      action: "switch",
      headline: "累積回報明顯低於扣費後參考，考慮轉套",
      detail: "用同一套參考年化比較，實際進度落後一截。先問年期同用錢時間有沒有變，再決定留守、再平衡或轉較穩／較進取的一套。",
    };
  }

  return {
    action: "stay",
    headline: "與預期大致相符，建議留守",
    detail: "週年主題是覆核目標、手續費年期同風險承受，而不是為了短線表現轉倉。",
  };
}

export function buildReviewSnapshot(
  portfolio: ResolvedPortfolio,
  startTs: number,
  asOf = Date.now(),
): ReviewSnapshot {
  const yearsElapsed = Math.max(yearsBetween(startTs, asOf), 0);
  const nav = navSince(portfolio.stats.navPoints, startTs);
  const expectedPct = expectedReturnSince(yearsElapsed, portfolio.stats.expectedPct);
  const removedCodes = portfolio.holdings
    .filter((holding) => holding.fund == null)
    .map((holding) => holding.code);
  const staleCodes = [
    ...new Set([
      ...portfolio.failedCodes,
      ...portfolio.holdings
        .filter((holding) => holding.fund != null && holding.oneYearPct == null)
        .map((holding) => holding.code),
    ]),
  ];
  const dataProvisional =
    portfolio.dataStatus === "provisional" ||
    (portfolio.stats.asOf != null && asOf - portfolio.stats.asOf > STALE_MS);

  const advice = suggestReviewTalkingPoint({
    actualPct: nav.actualPct,
    expectedPct,
    currentDrawdownPct: nav.currentDrawdownPct,
    yearsElapsed,
    removedCodes,
    staleCodes,
    dataProvisional,
  });

  return {
    yearsElapsed,
    actualPct: nav.actualPct,
    expectedPct,
    currentDrawdownPct: nav.currentDrawdownPct,
    navFrom: nav.from,
    navTo: nav.to,
    historyLimited: nav.historyLimited,
    removedCodes,
    staleCodes,
    dataProvisional,
    advice,
  };
}

export const PORTFOLIO_NAME_BY_ID: Record<PortfolioId, string> = {
  income: "派息入息",
  steady: "穩健增長",
  balanced: "均衡核心",
  growth: "進取增長",
};

export const PORTFOLIO_ID_ALIASES: Record<string, PortfolioId> = {
  income: "income",
  派息入息: "income",
  "派息": "income",
  steady: "steady",
  穩健增長: "steady",
  穩健: "steady",
  balanced: "balanced",
  均衡核心: "balanced",
  均衡: "balanced",
  growth: "growth",
  進取增長: "growth",
  進取: "growth",
};

export function parsePortfolioId(raw: string): PortfolioId | null {
  const key = raw.trim();
  return PORTFOLIO_ID_ALIASES[key] ?? PORTFOLIO_ID_ALIASES[key.toLowerCase()] ?? null;
}
