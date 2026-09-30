import assert from "node:assert/strict";
import { test } from "node:test";
import { navSince, suggestReviewTalkingPoint } from "./review";
import { parseFlexibleDate, parseReviewCsv, parseReviewRecords, serializeReviewCsv } from "./review-storage";

const DAY = 86_400_000;

test("parses Notion-style CSV headers and dates", () => {
  const csv = `姓名,保單週年,組合\n陳大文,15/3/2024,穩健增長\n`;
  const { records, errors } = parseReviewCsv(csv);
  assert.deepEqual(errors, []);
  assert.equal(records.length, 1);
  assert.equal(records[0].name, "陳大文");
  assert.equal(records[0].anniversary, "2024-03-15");
  assert.equal(records[0].portfolioId, "steady");
  assert.equal(records[0].startDate, "2024-03-15");
});

test("accepts English columns and an explicit start date", () => {
  const csv = `name,anniversary,portfolio,start_date\nLee,2023-06-01,income,2022-06-01\n`;
  const { records, errors } = parseReviewCsv(csv);
  assert.deepEqual(errors, []);
  assert.equal(records[0].portfolioId, "income");
  assert.equal(records[0].startDate, "2022-06-01");
});

test("round-trips CSV with Traditional Chinese portfolio names", () => {
  const csv = serializeReviewCsv([
    { id: "a", name: "測試,號", anniversary: "2025-01-02", portfolioId: "growth", startDate: "2020-01-02" },
  ]);
  const { records } = parseReviewCsv(csv);
  assert.equal(records[0].name, "測試,號");
  assert.equal(records[0].portfolioId, "growth");
  assert.equal(records[0].startDate, "2020-01-02");
});

test("parseFlexibleDate accepts ISO and D/M/YYYY", () => {
  assert.equal(parseFlexibleDate("2026-09-30"), "2026-09-30");
  assert.equal(parseFlexibleDate("30/9/2026"), "2026-09-30");
  assert.equal(parseFlexibleDate("not-a-date"), null);
});

test("garbage localStorage payload does not throw", () => {
  assert.deepEqual(parseReviewRecords(null), []);
  assert.deepEqual(parseReviewRecords([{ name: 1 }]), []);
});

test("navSince uses the first point on or after start and tracks current drawdown", () => {
  const start = Date.UTC(2024, 0, 1);
  const points = [
    { t: start, price: 100 },
    { t: start + 180 * DAY, price: 120 },
    { t: start + 360 * DAY, price: 90 },
  ];
  const result = navSince(points, start);
  assert.ok(result.actualPct != null);
  assert.ok(Math.abs(result.actualPct - -0.1) < 1e-9);
  assert.ok(result.currentDrawdownPct != null);
  assert.ok(Math.abs(result.currentDrawdownPct - -0.25) < 1e-9);
});

test("removed funds suggest rebalance", () => {
  const advice = suggestReviewTalkingPoint({
    actualPct: 0.1,
    expectedPct: 0.08,
    currentDrawdownPct: -0.04,
    yearsElapsed: 2,
    removedCodes: ["J20"],
    staleCodes: [],
    dataProvisional: false,
  });
  assert.equal(advice.action, "rebalance");
  assert.match(advice.detail, /J20/);
});

test("deep current drawdown suggests stay, not panic-sell", () => {
  const advice = suggestReviewTalkingPoint({
    actualPct: -0.18,
    expectedPct: 0.08,
    currentDrawdownPct: -0.22,
    yearsElapsed: 1.2,
    removedCodes: [],
    staleCodes: [],
    dataProvisional: false,
  });
  assert.equal(advice.action, "stay");
  assert.match(advice.headline, /回撤/);
});

test("large underperformance after a year suggests switch", () => {
  const advice = suggestReviewTalkingPoint({
    actualPct: -0.02,
    expectedPct: 0.12,
    currentDrawdownPct: -0.05,
    yearsElapsed: 2,
    removedCodes: [],
    staleCodes: [],
    dataProvisional: false,
  });
  assert.equal(advice.action, "switch");
});
