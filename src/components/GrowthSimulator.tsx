"use client";

import { useState } from "react";
import { formatHKD, projectValue } from "@/lib/growth-projection";
import { afterPolicyFee, POLICY_FEE_EARLY, POLICY_FEE_LATER } from "@/lib/policy-fees";
import { formatSignedPct } from "@/lib/portfolio-stats";

type Props = {
  /** 組合的年化預期回報（未扣保單費），例如 0.065 */
  gross: number | null;
  /** 描述 gross 的基礎，例如「過去5年年化」 */
  basisLabel: string;
  /**
   * 部分基金數據未能更新時只顯示「數據更新中」，
   * 不以局部數據作出看似完整的推算
   */
  provisional?: boolean;
};

const YEAR_OPTIONS = [5, 10, 15, 20];
const PRINCIPAL_PRESETS = [500_000, 1_000_000, 3_000_000];

export function GrowthSimulator({ gross, basisLabel, provisional = false }: Props) {
  const [principalInput, setPrincipalInput] = useState("1000000");
  const [years, setYears] = useState(10);

  const principal = Number(principalInput);
  const earlyNet = afterPolicyFee(gross, POLICY_FEE_EARLY);
  const laterNet = afterPolicyFee(gross, POLICY_FEE_LATER);
  const projected = projectValue(principal, years, earlyNet, laterNet);
  const gain = projected == null ? null : projected - principal;

  return (
    <section className="simulator" aria-label="滾存模擬">
      <h3 className="sim-title">滾存模擬</h3>
      {provisional ? (
        <p className="sim-note" role="status">
          數據更新中：部分基金數據暫未能更新，數據齊備後會顯示滾存模擬。
        </p>
      ) : gross == null ? (
        <p className="sim-note">暫無足夠數據作滾存模擬。</p>
      ) : (
        <>
          <div className="sim-row">
            <label className="sim-field">
              <span>本金（港元）</span>
              <input
                inputMode="numeric"
                autoComplete="off"
                value={principalInput}
                onChange={(e) => setPrincipalInput(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="1000000"
              />
            </label>
            <div className="sim-presets" role="group" aria-label="本金快捷選擇">
              {PRINCIPAL_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={principal === preset}
                  className={principal === preset ? "is-on" : undefined}
                  onClick={() => setPrincipalInput(String(preset))}
                >
                  {preset / 10000}萬
                </button>
              ))}
            </div>
          </div>

          <div className="sim-row">
            <span className="sim-label" id="sim-years-label">
              年期
            </span>
            <div className="sim-years" role="group" aria-labelledby="sim-years-label">
              {YEAR_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={years === option}
                  className={years === option ? "is-on" : undefined}
                  onClick={() => setYears(option)}
                >
                  {option}年
                </button>
              ))}
            </div>
          </div>

          {projected == null || gain == null || !Number.isFinite(principal) || principal <= 0 ? (
            <p className="sim-note">請輸入有效本金。</p>
          ) : (
            <div className="sim-result">
              <div>
                <p className="price-label">{years}年後預計總值</p>
                <p className="sim-total">{formatHKD(projected)}</p>
              </div>
              <div>
                <p className="price-label">淨變化</p>
                <p className={`metric-value ${gain >= 0 ? "is-up" : "is-down"}`}>
                  {gain >= 0 ? "+" : "−"}
                  {formatHKD(Math.abs(gain))}（{formatSignedPct(gain / principal)}）
                </p>
              </div>
            </div>
          )}

          <p className="sim-note">
            以{basisLabel} {formatSignedPct(gross)} 為基礎，按首5年扣費後 {formatSignedPct(earlyNet)}
            、第6年起扣費後 {formatSignedPct(laterNet)} 年化滾存，假設派息再投資。
          </p>
          <p className="sim-disclaimer">
            模擬僅供參考：假設每年回報固定等於上述數字，實際回報可升可跌。過往表現不代表將來表現，派息不保證。
          </p>
        </>
      )}
    </section>
  );
}
