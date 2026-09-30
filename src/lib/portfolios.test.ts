import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { PORTFOLIO_TEMPLATES, mapWithLimit, matchMixTemplate, resolveDataStatus } from "./portfolios";
import type { FundsDataset } from "./types";

function template(id: string) {
  const found = PORTFOLIO_TEMPLATES.find((item) => item.id === id);
  assert.ok(found, `missing template ${id}`);
  return found;
}

test("each mix has sleeve rationale, alternatives, and a one-line meeting risk", () => {
  for (const item of PORTFOLIO_TEMPLATES) {
    assert.ok(item.whySleeves.length > 20, item.id);
    assert.ok(item.alternatives.length > 20, item.id);
    assert.ok(item.meetingRisk.length > 8, item.id);
  }
});

test("mix copy does not cite an AIA house view or internal documents", () => {
  for (const item of PORTFOLIO_TEMPLATES) {
    const copy = [item.summary, item.principle, item.suitedFor, item.whySleeves, item.alternatives, item.meetingRisk].join(
      "\n",
    );
    assert.doesNotMatch(copy, /house view|內部文件|內部觀點|AIA 觀點/i, item.id);
  }
});

test("growth mix documents I07 over D14, CG1/J16, H01 vs QQQ, and I09/T09", () => {
  const growth = template("growth");
  assert.match(growth.whySleeves, /I07/);
  assert.match(growth.whySleeves, /D14/);
  assert.match(growth.whySleeves, /CG1/);
  assert.match(growth.whySleeves, /J16/);
  assert.match(growth.whySleeves, /H01/);
  assert.match(growth.whySleeves, /QQQ/);
  assert.match(growth.alternatives, /I09/);
  assert.match(growth.alternatives, /T09/);
  assert.doesNotMatch(`${growth.whySleeves}${growth.alternatives}${growth.summary}`, /N07|A15/);
});

test("balanced mix uses F11 Europe instead of a second global core", () => {
  const balanced = template("balanced");
  assert.match(balanced.whySleeves, /F11/);
  assert.match(balanced.whySleeves, /R03/);
  assert.match(balanced.whySleeves, /歐洲/);
  assert.match(balanced.alternatives, /I09/);
  assert.match(balanced.alternatives, /T09/);
  assert.doesNotMatch(`${balanced.whySleeves}${balanced.alternatives}${balanced.summary}`, /N07|A15|P07|J20/);
});

test("income mix warns that J16 is accumulation and will not pay cash into the policy", () => {
  const income = template("income");
  assert.match(income.whySleeves, /J16/);
  assert.match(income.whySleeves, /Z18/);
  assert.match(income.whySleeves, /Z13/);
  assert.match(income.whySleeves, /Z/);
  assert.doesNotMatch(`${income.whySleeves}${income.alternatives}${income.summary}`, /Z77|Z29/);
});

test("mapWithLimit preserves order and never exceeds the concurrency cap", async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const results = await mapWithLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight -= 1;
    return n * 10;
  });
  assert.deepEqual(
    results.map((result) => (result.ok ? result.value : null)),
    [10, 20, 30, 40, 50, 60],
  );
  assert.ok(maxInFlight <= 2, `maxInFlight was ${maxInFlight}`);
});

test("mapWithLimit records rejections instead of throwing", async () => {
  const results = await mapWithLimit(["a", "b", "c"], 4, async (code) => {
    if (code === "b") throw new Error("throttled");
    return code.toUpperCase();
  });
  const first = results[0];
  assert.equal(first.ok, true);
  if (first.ok) assert.equal(first.value, "A");
  assert.equal(results[1].ok, false);
  assert.equal(results[2].ok, true);
});

test("marks data provisional when any holding failed or coverage is thin", () => {
  assert.equal(resolveDataStatus([], 1), "ok");
  assert.equal(resolveDataStatus([], 0.6), "ok");
  assert.equal(resolveDataStatus(["H01"], 1), "provisional");
  assert.equal(resolveDataStatus([], 0.59), "provisional");
  assert.equal(resolveDataStatus(["Z77"], 0.2), "provisional");
});

test("steady mix uses the post-analysis sleeves (F14 / J16) and no longer steers new policies away", () => {
  assert.deepEqual(
    template("steady").sleeves.map((sleeve) => `${sleeve.code}:${sleeve.weight}`),
    ["W04:15", "W06:15", "R03:20", "F14:25", "J16:25"],
  );
  assert.match(template("steady").whySleeves, /F14/);
  assert.match(template("steady").whySleeves, /J16/);
  assert.doesNotMatch(template("steady").alternatives, /新單首 5 年較宜改用均衡核心/);
});

test("every published sleeve exists in the AIA catalogue with the expected name", () => {
  const dataset = JSON.parse(
    readFileSync(path.join(process.cwd(), "data", "funds.json"), "utf-8"),
  ) as FundsDataset;
  const names: Record<string, RegExp> = {
    Z36: /短期債券/,
    Z13: /美元高收益/,
    Z18: /富蘭克林入息/,
    Z07: /收益及增長/,
    Z17: /環球股票高息|高息/,
    W04: /貨幣市場/,
    W06: /短期債券/,
    R03: /平衡/,
    F14: /亞太入息/,
    J16: /環球收益股票/,
    F11: /歐洲動力/,
    CG1: /新視野/,
    H01: /環球科技/,
    I07: /世界黃金|黃金/,
  };
  const codes = [...new Set(PORTFOLIO_TEMPLATES.flatMap((item) => item.sleeves.map((sleeve) => sleeve.code)))];
  for (const code of codes) {
    const fund = dataset.funds.find((item) => item.code === code);
    assert.ok(fund, `${code} missing from data/funds.json`);
    const pattern = names[code];
    assert.ok(pattern, `missing name pattern for ${code}`);
    assert.match(fund.name, pattern, `${code} name ${fund.name}`);
  }
  const f14 = dataset.funds.find((fund) => fund.code === "F14");
  const j16 = dataset.funds.find((fund) => fund.code === "J16");
  assert.equal(f14?.type, "growth");
  assert.equal(j16?.type, "growth");
  const z13 = dataset.funds.find((fund) => fund.code === "Z13");
  const z18 = dataset.funds.find((fund) => fund.code === "Z18");
  assert.equal(z13?.type, "dividend");
  assert.equal(z18?.type, "dividend");
});

test("income / balanced / growth sleeve lists stay on the current published mixes", () => {
  assert.deepEqual(
    template("balanced").sleeves.map((sleeve) => `${sleeve.code}:${sleeve.weight}`),
    ["W06:10", "R03:20", "F14:20", "J16:25", "F11:25"],
  );
  assert.deepEqual(
    template("growth").sleeves.map((sleeve) => `${sleeve.code}:${sleeve.weight}`),
    ["W04:10", "CG1:30", "J16:20", "H01:25", "I07:15"],
  );
  assert.deepEqual(
    template("income").sleeves.map((sleeve) => `${sleeve.code}:${sleeve.weight}`),
    ["Z36:25", "Z13:10", "Z18:30", "Z07:10", "Z17:25"],
  );
});

test("current mix copy does not still pitch funds that are no longer held", () => {
  for (const item of PORTFOLIO_TEMPLATES) {
    const held = new Set(item.sleeves.map((sleeve) => sleeve.code));
    const copy = [item.summary, item.principle, item.whySleeves, item.alternatives, item.meetingRisk].join("\n");
    for (const retired of ["N07", "Z29", "Z77", "P07", "J20", "A15"]) {
      if (held.has(retired)) continue;
      assert.doesNotMatch(copy, new RegExp(`\\b${retired}\\b`), `${item.id} still mentions ${retired}`);
    }
  }
});

test("legacy share-link holdings still match the named mix", () => {
  assert.equal(
    matchMixTemplate([
      { code: "Z36", weight: 20 },
      { code: "Z77", weight: 20 },
      { code: "Z29", weight: 15 },
      { code: "Z07", weight: 25 },
      { code: "Z17", weight: 20 },
    ])?.id,
    "income",
  );
  assert.equal(
    matchMixTemplate([
      { code: "W06", weight: 10 },
      { code: "P07", weight: 25 },
      { code: "J20", weight: 20 },
      { code: "CG1", weight: 25 },
      { code: "A15", weight: 20 },
    ])?.id,
    "balanced",
  );
  assert.equal(
    matchMixTemplate([
      { code: "CG1", weight: 30 },
      { code: "N07", weight: 25 },
      { code: "H01", weight: 20 },
      { code: "I07", weight: 15 },
      { code: "W04", weight: 10 },
    ])?.id,
    "growth",
  );
});
