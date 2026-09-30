import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { PORTFOLIO_TEMPLATES, mapWithLimit, resolveDataStatus } from "./portfolios";
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

test("growth mix documents I07 over D14, CG1/N07, H01 vs QQQ, and I09/T09", () => {
  const growth = template("growth");
  assert.match(growth.whySleeves, /I07/);
  assert.match(growth.whySleeves, /D14/);
  assert.match(growth.whySleeves, /CG1/);
  assert.match(growth.whySleeves, /N07/);
  assert.match(growth.whySleeves, /H01/);
  assert.match(growth.whySleeves, /QQQ/);
  assert.match(growth.alternatives, /A15/);
  assert.match(growth.alternatives, /I09/);
  assert.match(growth.alternatives, /T09/);
});

test("balanced mix treats A15 as a satellite, not a second core", () => {
  const balanced = template("balanced");
  assert.match(balanced.whySleeves, /CG1/);
  assert.match(balanced.whySleeves, /A15/);
  assert.match(balanced.whySleeves, /衛星|重點/);
  assert.match(balanced.alternatives, /I09/);
  assert.match(balanced.alternatives, /T09/);
});

test("income mix warns that J16 is accumulation and will not pay cash into the policy", () => {
  const income = template("income");
  assert.match(income.whySleeves, /J16/);
  assert.match(income.whySleeves, /Z/);
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

test("F14 and J16 exist in the AIA catalogue with the expected names", () => {
  const dataset = JSON.parse(
    readFileSync(path.join(process.cwd(), "data", "funds.json"), "utf-8"),
  ) as FundsDataset;
  const f14 = dataset.funds.find((fund) => fund.code === "F14");
  const j16 = dataset.funds.find((fund) => fund.code === "J16");
  assert.ok(f14, "F14 missing from data/funds.json");
  assert.ok(j16, "J16 missing from data/funds.json");
  assert.match(f14.name, /亞太入息/);
  assert.match(j16.name, /環球收益股票/);
  assert.equal(f14.type, "growth");
  assert.equal(j16.type, "growth");
});

test("income / balanced / growth sleeve lists stay on the current published mixes", () => {
  assert.deepEqual(
    template("balanced").sleeves.map((sleeve) => `${sleeve.code}:${sleeve.weight}`),
    ["W06:10", "P07:25", "J20:20", "CG1:25", "A15:20"],
  );
  assert.deepEqual(
    template("growth").sleeves.map((sleeve) => `${sleeve.code}:${sleeve.weight}`),
    ["CG1:30", "N07:25", "H01:20", "I07:15", "W04:10"],
  );
  assert.deepEqual(
    template("income").sleeves.map((sleeve) => `${sleeve.code}:${sleeve.weight}`),
    ["Z36:20", "Z77:20", "Z29:15", "Z07:25", "Z17:20"],
  );
});
