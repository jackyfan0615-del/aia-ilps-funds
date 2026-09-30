import assert from "node:assert/strict";
import { test } from "node:test";
import { matchMixTemplate, PORTFOLIO_TEMPLATES } from "./portfolios";
import { INVESTMENT_DISCLAIMER_ZH } from "./insights-content";
import { buildShareReport, type MixSeries } from "./share-report";
import type { ResolvedHolding } from "./portfolios";
import type { PortfolioStats } from "./portfolio-stats";

const DAY = 86_400_000;

function stats(partial: Partial<PortfolioStats> = {}): PortfolioStats {
  return {
    expectedPct: 0.06,
    expectedHorizon: "5年年化",
    oneYearPct: 0.04,
    threeYearCagrPct: 0.05,
    fiveYearCagrPct: 0.06,
    volPct: 0.12,
    maxDrawdownPct: -0.18,
    maxDrawdownFrom: null,
    maxDrawdownTo: null,
    drawdownProxies: [],
    drawdownOmitted: [],
    riskLabel: "中等",
    dividendYieldPct: null,
    dividendYieldMethod: null,
    oneYearTotalPct: null,
    dividendSource: null,
    navPoints: [],
    asOf: Date.UTC(2026, 8, 28),
    coverage: 1,
    ...partial,
  };
}

function holding(code: string, weight: number): ResolvedHolding {
  return {
    code,
    weight,
    role: "配置",
    fund: {
      code,
      name: `${code} 基金`,
      risk: "中",
      bidPrice: "10",
      offerPrice: "10",
      valuationDate: "",
      morningstar: "",
      type: "growth",
      manager: "",
      assetClass: "",
      aum: "",
    },
    oneYearPct: 0.1,
    fiveYearCagrPct: 0.08,
    dividendYieldPct: null,
    dividendSource: null,
  };
}

test("matchMixTemplate recognises the four model portfolios regardless of order", () => {
  const growth = PORTFOLIO_TEMPLATES.find((item) => item.id === "growth");
  assert.ok(growth);
  const shuffled = [...growth.sleeves].reverse();
  const matched = matchMixTemplate(shuffled);
  assert.equal(matched?.id, "growth");
  assert.equal(matchMixTemplate([{ code: "CG1", weight: 100 }])?.id, undefined);
});

test("share report uses weighted NAV for since-start and this quarter, with after-fee and drawdown", () => {
  const start = Date.parse("2024-01-01T00:00:00+08:00");
  const q3 = Date.parse("2026-07-01T00:00:00+08:00");
  const navPoints = [
    { t: start, price: 100 },
    { t: start + 200 * DAY, price: 110 },
    { t: q3, price: 120 },
    { t: q3 + 40 * DAY, price: 108 },
    { t: q3 + 80 * DAY, price: 126 },
  ];
  const mix: MixSeries = {
    name: "均衡核心",
    style: "增長",
    holdings: [holding("CG1", 60), holding("H01", 40)],
    stats: stats({ navPoints, expectedPct: 0.05, expectedHorizon: "5年年化" }),
    dataStatus: "ok",
    failedCodes: [],
    charts: {
      CG1: [
        { t: start, price: 50 },
        { t: q3, price: 60 },
        { t: q3 + 80 * DAY, price: 66 },
      ],
      H01: [
        { t: start, price: 80 },
        { t: q3, price: 70 },
        { t: q3 + 80 * DAY, price: 77 },
      ],
    },
  };
  const report = buildShareReport({
    mix,
    startDate: "2024-01-01",
    quarter: "2026Q3",
    latestMarket: { title: "週報標題", date: "2026-09-28", href: "/insights/market/2026-09-28" },
    asOf: Date.parse("2026-09-28T04:00:00+08:00"),
  });
  assert.equal(report.mixName, "均衡核心");
  assert.equal(report.quarterLabelZh, "2026年第3季");
  assert.ok(report.sinceStartPct != null);
  assert.ok(Math.abs((report.sinceStartPct ?? 0) - 0.26) < 1e-9);
  assert.ok(report.quarterPct != null);
  assert.ok(Math.abs((report.quarterPct ?? 0) - 0.05) < 1e-9);
  assert.ok(report.afterFeePct != null);
  assert.ok(report.currentDrawdownPct != null);
  assert.ok((report.currentDrawdownPct ?? 0) < 0);
  assert.equal(report.holdings[0].code, "CG1");
  assert.ok(report.holdings[0].sinceStartPct != null);
  assert.ok(report.holdings[0].quarterPct != null);
  assert.equal(report.latestMarket?.title, "週報標題");
  assert.equal(report.disclaimer, INVESTMENT_DISCLAIMER_ZH);
  assert.doesNotMatch(JSON.stringify(report), /佣金|話術|會面|建議：留守|轉套/);
});

test("share report does not encode a client name", () => {
  const mix: MixSeries = {
    name: "自選組合",
    style: "增長",
    holdings: [holding("W04", 100)],
    stats: stats({ navPoints: [{ t: 1, price: 1 }, { t: 2, price: 1.1 }] }),
    dataStatus: "ok",
    failedCodes: [],
    charts: { W04: [{ t: 1, price: 1 }, { t: 2, price: 1.1 }] },
  };
  const report = buildShareReport({
    mix,
    startDate: "2025-01-01",
    quarter: "2026Q1",
    latestMarket: null,
  });
  assert.doesNotMatch(JSON.stringify(report), /姓名|clientName|displayName/);
});
