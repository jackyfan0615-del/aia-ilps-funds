import assert from "node:assert/strict";
import { test } from "node:test";
import { computeDividendSource, FROM_CAPITAL_LABEL } from "./dividend-source";

test("1y total minus yield equals the price change", () => {
  const source = computeDividendSource({
    yieldPct: 0.067,
    oneYearPricePct: -0.005,
  });
  assert.ok(source);
  assert.ok(source.oneYearTotalPct != null);
  assert.ok(Math.abs(source.oneYearTotalPct - 0.062) < 1e-9);
  assert.ok(source.oneYearCapitalPct != null);
  assert.ok(Math.abs(source.oneYearCapitalPct - -0.005) < 1e-9);
  assert.equal(source.fromCapital, true);
});

test("flags Z07-style 5y NAV erosion even if 1y is flat", () => {
  const source = computeDividendSource({
    yieldPct: 0.078,
    oneYearPricePct: 0.002,
    fiveYearPriceCagrPct: -0.038,
  });
  assert.ok(source);
  assert.equal(source.fromCapital, true);
  assert.ok(source.fiveYearCapitalPct != null);
  assert.ok(source.fiveYearCapitalPct < 0);
});

test("does not flag when total return covers the yield", () => {
  const source = computeDividendSource({
    yieldPct: 0.075,
    oneYearPricePct: 0.065,
    fiveYearPriceCagrPct: 0.088,
  });
  assert.ok(source);
  assert.equal(source.fromCapital, false);
  assert.ok(source.oneYearCapitalPct != null && source.oneYearCapitalPct > 0);
});

test("portfolio example: yield 6.7% vs 1y total ~6.2% is capital erosion", () => {
  const source = computeDividendSource({
    yieldPct: 0.067,
    oneYearPricePct: 0.062 - 0.067,
  });
  assert.ok(source);
  assert.ok(source.oneYearTotalPct != null && source.oneYearTotalPct < source.yieldPct!);
  assert.equal(source.fromCapital, true);
});

test("returns null when there is no yield or return data", () => {
  assert.equal(computeDividendSource({ yieldPct: null, oneYearPricePct: null }), null);
});

test("capital-from-principal label is Traditional Chinese", () => {
  assert.equal(FROM_CAPITAL_LABEL, "部分派息來自本金");
});
