import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_ANSWERS } from "./suitability";
import { parseOpenIds, parseQuizAnswers } from "./quiz-storage";

describe("parseQuizAnswers", () => {
  it("keeps a complete valid answer set", () => {
    assert.deepEqual(parseQuizAnswers({ horizon: "mid", goal: "growth", drawdown: "moderate" }), {
      horizon: "mid",
      goal: "growth",
      drawdown: "moderate",
    });
  });

  it("drops unknown option values but keeps valid ones", () => {
    assert.deepEqual(parseQuizAnswers({ horizon: "someday", goal: "income", drawdown: null }), {
      horizon: null,
      goal: "income",
      drawdown: null,
    });
  });

  it("returns EMPTY_ANSWERS for garbage input", () => {
    for (const raw of [null, undefined, 42, "income", [], { horizon: ["long"] }]) {
      assert.deepEqual(parseQuizAnswers(raw), EMPTY_ANSWERS);
    }
  });
});

describe("parseOpenIds", () => {
  it("keeps only known portfolio ids", () => {
    const ids = parseOpenIds(["income", "nope", 42], ["income", "steady", "balanced", "growth"]);
    assert.deepEqual([...ids].sort(), ["income"]);
  });

  it("returns an empty set for garbage input", () => {
    assert.equal(parseOpenIds(null, ["income"]).size, 0);
    assert.equal(parseOpenIds("income", ["income"]).size, 0);
  });
});
