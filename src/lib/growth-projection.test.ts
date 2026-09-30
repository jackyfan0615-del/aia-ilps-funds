import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatHKD, projectStressPath, projectValue } from "./growth-projection";

describe("projectValue", () => {
  it("compounds the first 5 years at the early rate and later years at the later rate", () => {
    // 1.05^5 * 1.06^5 = 1.707952…
    const value = projectValue(1_000_000, 10, 0.05, 0.06);
    assert.ok(value != null);
    assert.ok(Math.abs(value - 1_707_952.63) < 1, `got ${value}`);
  });

  it("uses only the early rate for horizons of 5 years or less", () => {
    const value = projectValue(1_000_000, 5, 0.05, 0.09);
    assert.ok(value != null);
    assert.ok(Math.abs(value - 1_276_281.56) < 1, `got ${value}`);
  });

  it("handles a single year", () => {
    assert.equal(projectValue(1_000_000, 1, 0.05, 0.06), 1_050_000);
  });

  it("handles negative net returns", () => {
    // 0.98^5 = 0.9039207968
    const value = projectValue(1_000_000, 5, -0.02, -0.01);
    assert.ok(value != null);
    assert.ok(Math.abs(value - 903_920.8) < 1, `got ${value}`);
  });

  it("returns null for missing rates, bad principal, or bad years", () => {
    assert.equal(projectValue(1_000_000, 10, null, 0.06), null);
    assert.equal(projectValue(1_000_000, 10, 0.05, null), null);
    assert.equal(projectValue(1_000_000, 3, 0.05, null), 1_000_000 * 1.05 ** 3);
    assert.equal(projectValue(0, 10, 0.05, 0.06), null);
    assert.equal(projectValue(-100, 10, 0.05, 0.06), null);
    assert.equal(projectValue(1_000_000, 0, 0.05, 0.06), null);
    assert.equal(projectValue(1_000_000, 51, 0.05, 0.06), null);
    assert.equal(projectValue(1_000_000, 10, -1, 0.06), null);
    assert.equal(projectValue(Number.NaN, 10, 0.05, 0.06), null);
  });
});

describe("projectStressPath", () => {
  it("applies the historical max drawdown in year 1 then compounds at the after-fee rate", () => {
    const stress = projectStressPath(1_000_000, 10, -0.254, 0.04, 0.052);
    assert.ok(stress);
    assert.equal(stress.year1Value, 746_000);
    // 746000 * 1.04^4 * 1.052^5
    const expected = 746_000 * 1.04 ** 4 * 1.052 ** 5;
    assert.ok(Math.abs(stress.endValue - expected) < 1, `got ${stress.endValue}`);
    assert.ok(stress.yearsToRecover != null && stress.yearsToRecover > 1);
    assert.ok(stress.path[0] === 1_000_000);
    assert.ok(stress.path[1] === 746_000);
  });

  it("returns null when there is no negative drawdown or the rate is unusable", () => {
    assert.equal(projectStressPath(1_000_000, 10, 0, 0.04, 0.05), null);
    assert.equal(projectStressPath(1_000_000, 10, null, 0.04, 0.05), null);
    assert.equal(projectStressPath(1_000_000, 10, -0.2, null, 0.05), null);
  });

  it("reports null recovery when the after-fee rate stays negative", () => {
    const stress = projectStressPath(1_000_000, 10, -0.2, -0.02, -0.01);
    assert.ok(stress);
    assert.equal(stress.yearsToRecover, null);
  });
});

describe("formatHKD", () => {
  it("formats rounded dollar amounts with thousands separators", () => {
    assert.equal(formatHKD(1_000_000), "HK$1,000,000");
    assert.equal(formatHKD(1_707_954.5), "HK$1,707,955");
    assert.equal(formatHKD(903_920.4), "HK$903,920");
  });
});
