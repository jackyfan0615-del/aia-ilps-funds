import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computePortfolioStats,
  drawdownDisclosure,
  drawdownPeriodLabel,
  formatSignedPct,
} from "./portfolio-stats";
import { legacyMaxDrawdownPct } from "./portfolio-stats-legacy";
import { PORTFOLIO_TEMPLATES } from "./portfolios";
import { resolveRiskSeries } from "./price-proxies";
import type { ChartPoint } from "./types";

const DAY = 86_400_000;
const START = Date.UTC(2020, 9, 21); // 2020-10-21
const PEAK = Date.UTC(2021, 10, 8); // 2021-11-08
const TROUGH = Date.UTC(2022, 9, 14); // 2022-10-14
const SHORT_START = Date.UTC(2025, 9, 23); // 2025-10-23
const END = Date.UTC(2026, 8, 29); // 2026-09-29

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function progress(t: number, a: number, b: number): number {
  if (b === a) return 0;
  return Math.min(1, Math.max(0, (t - a) / (b - a)));
}

function path(
  start: number,
  end: number,
  priceAt: (t: number) => number,
  stepDays = 7,
): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (let t = start; t <= end; t += stepDays * DAY) {
    points.push({ t, price: priceAt(t) });
  }
  if (points[points.length - 1].t !== end) points.push({ t: end, price: priceAt(end) });
  return points;
}

/** Mild cash-like path; 2022 barely moves. */
function cashSeries(from = START): ChartPoint[] {
  return path(from, END, (t) => 100 + ((t - START) / DAY) * 0.004);
}

/** Short-duration bond: about −5% peak-to-trough in 2022. */
function shortBondSeries(from = START): ChartPoint[] {
  return path(from, END, (t) => {
    if (t <= PEAK) return lerp(100, 102, progress(t, START, PEAK));
    if (t <= TROUGH) return lerp(102, 96.9, progress(t, PEAK, TROUGH));
    return lerp(96.9, 108, progress(t, TROUGH, END));
  });
}

/** Balanced / multi-asset: about −22% in 2022. */
function balancedSeries(from = START): ChartPoint[] {
  return path(from, END, (t) => {
    if (t <= PEAK) return lerp(100, 120, progress(t, START, PEAK));
    if (t <= TROUGH) return lerp(120, 93.6, progress(t, PEAK, TROUGH));
    return lerp(93.6, 145, progress(t, TROUGH, END));
  });
}

/** Global equity: about −35% in 2022 (CG1-like). */
function equitySeries(from = START): ChartPoint[] {
  return path(from, END, (t) => {
    if (t <= PEAK) return lerp(100, 130, progress(t, START, PEAK));
    if (t <= TROUGH) return lerp(130, 84.5, progress(t, PEAK, TROUGH));
    return lerp(84.5, 160, progress(t, TROUGH, END));
  });
}

const FIXTURES: Record<string, ChartPoint[]> = {
  W04: cashSeries(),
  W06: shortBondSeries(SHORT_START),
  B01: shortBondSeries(),
  R03: balancedSeries(),
  A32: balancedSeries(),
  CG1: equitySeries(),
  P07: balancedSeries(),
  J20: balancedSeries(Date.UTC(2025, 0, 23)),
  A15: equitySeries(),
  N07: equitySeries(),
  H01: equitySeries(),
  I07: path(START, END, (t) => {
    if (t <= PEAK) return lerp(100, 110, progress(t, START, PEAK));
    if (t <= TROUGH) return lerp(110, 95, progress(t, PEAK, TROUGH));
    return lerp(95, 180, progress(t, TROUGH, END));
  }),
  Z36: shortBondSeries(SHORT_START),
  Z77: [],
  W07: [],
  Z29: balancedSeries(Date.UTC(2025, 3, 24)),
  M11: path(START, END, (t) => {
    if (t <= PEAK) return lerp(100, 105, progress(t, START, PEAK));
    if (t <= TROUGH) return lerp(105, 80, progress(t, PEAK, TROUGH));
    return lerp(80, 100, progress(t, TROUGH, END));
  }),
  Z07: balancedSeries(),
  Z17: equitySeries(Date.UTC(2023, 3, 27)),
  J16: equitySeries(),
  F14: path(START, END, (t) => {
    if (t <= PEAK) return lerp(100, 108, progress(t, START, PEAK));
    if (t <= TROUGH) return lerp(108, 94.5, progress(t, PEAK, TROUGH));
    return lerp(94.5, 140, progress(t, TROUGH, END));
  }),
  I17: equitySeries(Date.UTC(2023, 3, 27)),
  Z20: balancedSeries(Date.UTC(2025, 0, 23)),
  CG9: balancedSeries(Date.UTC(2025, 3, 24)),
};

const charts = new Map(Object.entries(FIXTURES));

function ownHoldings(id: string) {
  const template = PORTFOLIO_TEMPLATES.find((item) => item.id === id);
  assert.ok(template);
  return template.sleeves.map((sleeve) => ({
    code: sleeve.code,
    weight: sleeve.weight,
    points: charts.get(sleeve.code) ?? [],
  }));
}

function riskHoldings(id: string) {
  return ownHoldings(id).map((holding) => {
    const risk = resolveRiskSeries(holding.code, holding.points, charts);
    return {
      ...holding,
      riskPoints: risk.points,
      drawdownProxy: risk.proxy,
      omittedFromDrawdown: risk.omitted,
    };
  });
}

function pct(value: number | null): string {
  return formatSignedPct(value);
}

test("max drawdown uses the weighted NAV including 2022 instead of averaging 3-year fund drawdowns", () => {
  const rows = PORTFOLIO_TEMPLATES.map((template) => {
    const own = ownHoldings(template.id);
    const next = computePortfolioStats(riskHoldings(template.id));
    return {
      id: template.id,
      name: template.name,
      before: legacyMaxDrawdownPct(own),
      after: next.maxDrawdownPct,
      period: drawdownPeriodLabel(next),
      note: drawdownDisclosure(next),
    };
  });

  const table = [
    "| 組合 | 舊邏輯（各基金 3 年回撤平均／短窗 NAV） | 新邏輯（加權組合 NAV，含 2022） | 期間／代理 |",
    "|---|---|---|---|",
    ...rows.map(
      (row) =>
        `| ${row.name} | ${pct(row.before)} | ${pct(row.after)} | ${row.period}${row.note ? `；${row.note}` : ""} |`,
    ),
  ].join("\n");
  console.log(`\n${table}\n`);

  const byId = Object.fromEntries(rows.map((row) => [row.id, row]));

  assert.ok(byId.steady.before != null && byId.steady.after != null);
  assert.ok(
    Math.abs(byId.steady.before) < 0.12,
    `舊穩健應低估風險，got ${byId.steady.before}`,
  );
  assert.ok(
    Math.abs(byId.steady.after) > 0.14,
    `新穩健應反映 2022，got ${byId.steady.after}`,
  );
  assert.match(byId.steady.note ?? "", /W06.*B01/);

  assert.ok(byId.balanced.before != null && byId.balanced.after != null);
  assert.ok(Math.abs(byId.balanced.before) < 0.16, `舊均衡應低估風險，got ${byId.balanced.before}`);
  assert.ok(Math.abs(byId.balanced.after) > 0.18, `新均衡應反映 2022，got ${byId.balanced.after}`);
  assert.match(byId.balanced.note ?? "", /W06.*B01/);
  assert.match(byId.balanced.note ?? "", /J20.*R03/);

  assert.ok(byId.growth.before != null && byId.growth.after != null);
  assert.ok(
    Math.abs((byId.growth.before ?? 0) - (byId.growth.after ?? 0)) < 0.002,
    "進取各基金均有 2022 價，新舊應一致",
  );
  assert.equal(byId.growth.note, null);

  assert.ok(byId.income.after != null);
  assert.match(byId.income.note ?? "", /Z77 走勢不足/);
});

test("return metrics still use own prices, not the proxy path", () => {
  const stats = computePortfolioStats(riskHoldings("steady"));
  assert.ok(stats.fiveYearCagrPct != null);
  const w06Only = computePortfolioStats([
    { code: "W06", weight: 100, points: FIXTURES.W06, riskPoints: FIXTURES.B01 },
  ]);
  assert.equal(w06Only.fiveYearCagrPct, null, "W06 自身不足 5 年，年化不應因代理而出現");
});

test("drawdown labels are Traditional Chinese and include the window", () => {
  const stats = computePortfolioStats(riskHoldings("steady"));
  assert.match(drawdownPeriodLabel(stats), /年.*月至.*年.*月 · 組合高峰至低位/);
  const note = drawdownDisclosure(stats);
  assert.ok(note);
  assert.match(note, /於 .*前以 B01 代理/);
  assert.match(note, /同類美元短債/);
});
