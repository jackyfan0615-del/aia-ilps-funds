import assert from "node:assert/strict";
import { test } from "node:test";
import { PORTFOLIO_TEMPLATES } from "./portfolios";

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
