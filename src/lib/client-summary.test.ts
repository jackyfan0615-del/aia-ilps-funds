import assert from "node:assert/strict";
import { test } from "node:test";
import { buildClientSummary, clientSummaryHtml, SUMMARY_DISCLAIMERS_ZH } from "./client-summary";
import { FROM_CAPITAL_LABEL } from "./dividend-source";
import type { ResolvedPortfolio } from "./portfolios";
import { EMPTY_ANSWERS } from "./suitability";

function portfolio(partial: Partial<ResolvedPortfolio> = {}): ResolvedPortfolio {
  return {
    id: "income",
    name: "派息入息",
    risk: "中等",
    style: "派息",
    summary: "",
    principle: "",
    suitedFor: "",
    whySleeves: "",
    alternatives: "",
    meetingRisk: "淨值會波動",
    holdings: [
      { code: "Z07", weight: 25, role: "核心入息", fund: null, oneYearPct: -0.005, fiveYearCagrPct: -0.038, dividendYieldPct: 0.078, dividendSource: null },
    ],
    stats: {
      expectedPct: 0.062,
      expectedHorizon: "1年",
      oneYearPct: -0.005,
      threeYearCagrPct: null,
      fiveYearCagrPct: -0.038,
      volPct: 0.05,
      maxDrawdownPct: -0.12,
      maxDrawdownFrom: Date.UTC(2021, 10, 1),
      maxDrawdownTo: Date.UTC(2022, 9, 1),
      drawdownProxies: [],
      drawdownOmitted: [],
      riskLabel: "中低",
      dividendYieldPct: 0.067,
      dividendYieldMethod: "ttm",
      oneYearTotalPct: 0.062,
      dividendSource: {
        yieldPct: 0.067,
        oneYearTotalPct: 0.062,
        oneYearCapitalPct: -0.005,
        fiveYearCapitalPct: -0.038,
        fromCapital: true,
      },
      navPoints: [],
      asOf: Date.UTC(2026, 8, 28),
      coverage: 1,
    },
    dataStatus: "ok",
    failedCodes: [],
    ...partial,
  };
}

test("summary includes the four answers, mix, fees, drawdown, stress and disclaimers", () => {
  const model = buildClientSummary({
    clientName: "測試客人",
    answers: { horizon: "mid", goal: "income", drawdown: "moderate", withdrawal: "fiveToTen" },
    pick: { id: "income", reason: "要現金股息", caution: "提早賣出風險" },
    portfolio: portfolio(),
    now: new Date("2026-09-30T04:00:00.000Z"),
  });
  assert.equal(model.clientName, "測試客人");
  assert.match(model.answers.withdrawal, /5–10/);
  assert.match(model.mix, /Z07 25%/);
  assert.ok(model.stressYear1);
  assert.ok(model.stressRecover);
  assert.ok(model.dividendNote);
  assert.match(model.dividendNote ?? "", new RegExp(FROM_CAPITAL_LABEL));
  assert.deepEqual(model.disclaimers, SUMMARY_DISCLAIMERS_ZH);
});

test("print HTML is a single A4 document and does not embed storage hooks", () => {
  const html = clientSummaryHtml(
    buildClientSummary({
      clientName: "A <B>",
      answers: { ...EMPTY_ANSWERS, horizon: "long", goal: "income", drawdown: "can", withdrawal: "beyond10" },
      pick: { id: "income", reason: "reason", caution: null },
      portfolio: portfolio(),
    }),
  );
  assert.match(html, /A4/);
  assert.match(html, /A &lt;B&gt;/);
  assert.doesNotMatch(html, /localStorage|fetch\(|IndexedDB/);
  assert.match(html, /陳|A &lt;B&gt;/);
  assert.match(html, /並非投資建議/);
  assert.match(html, /過往表現不代表將來表現/);
  assert.match(html, /派息不保證/);
});
