import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_ANSWERS, recommendPortfolio, type SuitabilityAnswers } from "./suitability";

function answers(partial: Partial<SuitabilityAnswers>): SuitabilityAnswers {
  return { ...EMPTY_ANSWERS, withdrawal: "beyond10", ...partial };
}

test("returns null until all four questions are answered", () => {
  assert.equal(recommendPortfolio(EMPTY_ANSWERS), null);
  assert.equal(recommendPortfolio(answers({ horizon: "long", goal: "growth", drawdown: "can", withdrawal: null })), null);
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
  assert.match(result?.reason ?? "", /手續費|短債/);
});

test("long horizon plus a 2022-style drawdown and money after 10 years maps to growth", () => {
  const result = recommendPortfolio(
    answers({ horizon: "long", goal: "growth", drawdown: "can", withdrawal: "beyond10" }),
  );
  assert.equal(result?.id, "growth");
});

test("first five years or moderate drawdown maps to balanced when money is far out", () => {
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
    answers({ horizon: "under5", goal: "growth", drawdown: "moderate", withdrawal: "beyond10" }),
  );
  assert.equal(result?.id, "steady");
  assert.match(result?.caution ?? "", /手續費|不應推投連險/);
});

test("needing money within 5 years pushes off growth and warns about fees plus selling in a downturn", () => {
  const cannot = recommendPortfolio(
    answers({ horizon: "long", goal: "growth", drawdown: "cannot", withdrawal: "within5" }),
  );
  assert.equal(cannot?.id, "steady");
  assert.match(cannot?.caution ?? "", /首 5 年手續費/);
  assert.match(cannot?.caution ?? "", /跌市/);

  const can = recommendPortfolio(
    answers({ horizon: "long", goal: "growth", drawdown: "can", withdrawal: "within5" }),
  );
  assert.equal(can?.id, "balanced");
  assert.notEqual(can?.id, "growth");
  assert.match(can?.caution ?? "", /手續費/);
});

test("5–10 year or no-plan withdrawal stays on balanced instead of growth", () => {
  assert.equal(
    recommendPortfolio(answers({ horizon: "long", goal: "growth", drawdown: "can", withdrawal: "fiveToTen" }))?.id,
    "balanced",
  );
  assert.equal(
    recommendPortfolio(answers({ horizon: "long", goal: "growth", drawdown: "can", withdrawal: "noPlan" }))?.id,
    "balanced",
  );
});
