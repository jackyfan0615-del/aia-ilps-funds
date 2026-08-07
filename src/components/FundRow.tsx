import type { Fund } from "@/lib/types";
import { typeLabel } from "@/lib/labels";
function riskClass(risk: string) {
  if (risk === "高") return "risk-high";
  if (risk === "中") return "risk-mid";
  return "risk-low";
}

export function FundRow({ fund }: { fund: Fund }) {
  return (
    <article className="fund-row">
      <div className="fund-row-main">
        <div className="fund-codes">
          <span className="fund-code">{fund.code}</span>
          <span className={`fund-type ${fund.type === "dividend" ? "is-div" : "is-growth"}`}>
            {typeLabel(fund.type)}
          </span>
          <span className={`fund-risk ${riskClass(fund.risk)}`}>{fund.risk}風險</span>
        </div>
        <h2 className="fund-name">{fund.name}</h2>
        <p className="fund-meta">
          <span>{fund.assetClass || "—"}</span>
          {fund.manager ? <span>{fund.manager}</span> : null}
        </p>
      </div>
      <div className="fund-price">
        <p className="price-label">賣出價</p>
        <p className="price-value">{fund.bidPrice || "—"}</p>
        <p className="price-date">{fund.valuationDate || "—"}</p>
        {fund.morningstar ? (
          <p className="price-stars" aria-label={`星號評級 ${fund.morningstar}`}>
            {fund.morningstar}
          </p>
        ) : null}
      </div>
    </article>
  );
}
