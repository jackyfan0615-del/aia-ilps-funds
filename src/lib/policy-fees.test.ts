import assert from "node:assert/strict";
import { test } from "node:test";
import { afterPolicyFee, POLICY_FEE_EARLY, POLICY_FEE_LATER } from "./policy-fees";

test("policy fee constants stay as adjustable fractions, not hardcoded copy", () => {
  assert.equal(POLICY_FEE_EARLY, 0.0238);
  assert.equal(POLICY_FEE_LATER, 0.012);
});

test("net-of-fee return subtracts the policy charge from the gross expected return", () => {
  assert.equal(afterPolicyFee(0.08, POLICY_FEE_EARLY), 0.0562);
  assert.equal(afterPolicyFee(0.08, POLICY_FEE_LATER), 0.068);
  assert.equal(afterPolicyFee(null, POLICY_FEE_EARLY), null);
  assert.equal(afterPolicyFee(Number.NaN, POLICY_FEE_EARLY), null);
});
