import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_ANSWERS, recommendPortfolio, type SuitabilityAnswers } from "./suitability";

function answers(partial: Partial<SuitabilityAnswers>): SuitabilityAnswers {
  return { ...EMPTY_ANSWERS, ...partial };
}

test("returns null until all three questions are answered", () => {
  assert.equal(recommendPortfolio(EMPTY_ANSWERS), null);
  assert.equal(
    recommendPortfolio(answers({ horizon: "long", goal: "growth" })),
    null,
  );
});

test("cash income always maps to the income mix", () => {
  const result = recommendPortfolio(
    answers({ horizon: "long", goal: "income", drawdown: "can" }),
  );
  assert.equal(result?.id, "income");
  assert.match(result?.reason ?? "", /現金股息/);
});

test("cannot take a large drawdown maps to steady, with the fee warning", () => {
  const result = recommendPortfolio(
    answers({ horizon: "mid", goal: "growth", drawdown: "cannot" }),
  );
  assert.equal(result?.id, "steady");
  assert.match(result?.reason ?? "", /手續費/);
});

test("long horizon plus a 2022-style drawdown maps to growth", () => {
  const result = recommendPortfolio(
    answers({ horizon: "long", goal: "growth", drawdown: "can" }),
  );
  assert.equal(result?.id, "growth");
});

test("first five years or moderate drawdown maps to balanced", () => {
  assert.equal(
    recommendPortfolio(answers({ horizon: "mid", goal: "growth", drawdown: "moderate" }))?.id,
    "balanced",
  );
  assert.equal(
    recommendPortfolio(answers({ horizon: "long", goal: "growth", drawdown: "moderate" }))?.id,
    "balanced",
  );
  assert.equal(
    recommendPortfolio(answers({ horizon: "mid", goal: "growth", drawdown: "can" }))?.id,
    "balanced",
  );
});

test("horizon under five years still recommends a mix but flags that ILPS is usually a poor fit", () => {
  const result = recommendPortfolio(
    answers({ horizon: "under5", goal: "growth", drawdown: "moderate" }),
  );
  assert.equal(result?.id, "balanced");
  assert.match(result?.caution ?? "", /不應推投連險/);
});
