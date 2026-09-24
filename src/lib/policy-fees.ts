/** Typical 卓達智悅 2 policy charges as a fraction of account value. Override if a case differs. */
export const POLICY_FEE_EARLY = 0.0238;
export const POLICY_FEE_LATER = 0.012;

export function afterPolicyFee(gross: number | null, fee: number): number | null {
  if (gross == null || !Number.isFinite(gross)) return null;
  return gross - fee;
}
