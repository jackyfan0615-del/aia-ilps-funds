import Link from "next/link";
import type { Fund } from "@/lib/types";
import { typeLabel } from "@/lib/labels";
import { formatDrawdown, safetyLabelText, type SafetyLabel } from "@/lib/safety-format";

function riskClass(risk: string) {
  if (risk === "高") return "risk-high";
  if (risk === "中") return "risk-mid";
  return "risk-low";
}

type Props = {
  fund: Fund;
  hasResearch?: boolean;
  safetyLabel?: SafetyLabel;
  dd5?: number;
};

export function FundRow({ fund, hasResearch = false, safetyLabel = "none", dd5 }: Props) {
  const safetyText = safetyLabelText(safetyLabel);
  return (
    <Link href={`/funds/${fund.code}`} className="fund-row">
      <div className="fund-row-main">
        <div className="fund-codes">
          <span className="fund-code">{fund.code}</span>
          <span className={`fund-type ${fund.type === "dividend" ? "is-div" : "is-growth"}`}>
            {typeLabel(fund.type)}
          </span>
          <span className={`fund-risk ${riskClass(fund.risk)}`}>{fund.risk}風險</span>
          {hasResearch ? <span className="fund-research-badge">研究</span> : null}
          {safetyText ? (
            <span className={`fund-safety-badge is-${safetyLabel}`}>{safetyText}</span>
          ) : null}
        </div>
        <h2 className="fund-name">{fund.name}</h2>
        <p className="fund-meta">
          <span>{fund.assetClass || "—"}</span>
          {fund.manager ? <span>{fund.manager}</span> : null}
          <span className="fund-trend-hint">
            {hasResearch ? "點入查看研究備註與價格走勢" : "點入查看價格走勢"}
          </span>
        </p>
      </div>
      <div className="fund-price">
        <p className="price-label">賣出價</p>
        <p className="price-value">{fund.bidPrice || "—"}</p>
        <p className="price-date">{fund.valuationDate || "—"}</p>
        {dd5 != null ? <p className="price-dd">{formatDrawdown(dd5)}</p> : null}
        {fund.morningstar ? (
          <p className="price-stars" aria-label={`星號評級 ${fund.morningstar}`}>
            {fund.morningstar}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
