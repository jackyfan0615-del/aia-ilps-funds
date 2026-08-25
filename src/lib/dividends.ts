import type { DividendPayout } from "./aia";

const MS_DAY = 86_400_000;

export type DividendYield = {
  pct: number;
  method: "ttm" | "annualized";
  payments: number;
};

export function estimateDividendYield(
  payouts: DividendPayout[],
  bid: number,
  asOf = Date.now(),
): DividendYield | null {
  if (bid <= 0 || payouts.length === 0) return null;
  const cutoff = asOf - 366 * MS_DAY;
  const recent = payouts.filter((payout) => payout.t >= cutoff && payout.t <= asOf + MS_DAY);
  const used = recent.length > 0 ? recent : payouts.slice(0, 12);
  if (used.length === 0) return null;

  const sum = used.reduce((total, payout) => total + payout.rate, 0);
  if (used.length >= 11) {
    return { pct: sum / bid, method: "ttm", payments: used.length };
  }
  if (used.length >= 6) {
    return { pct: (sum / used.length) * 12 / bid, method: "annualized", payments: used.length };
  }
  const latest = used[0].rate;
  return { pct: (latest * 12) / bid, method: "annualized", payments: used.length };
}

export function dividendYieldLabel(method: DividendYield["method"] | undefined): string {
  if (method === "annualized") return "按近月年化（紀錄不足12個月）";
  if (method === "ttm") return "過去12個月派息／最新賣出價";
  return "AIA 現金派息紀錄";
}
