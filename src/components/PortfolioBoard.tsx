"use client";

import type { ResolvedPortfolio } from "@/lib/portfolios";
import { typeLabel } from "@/lib/labels";

type Props = {
  portfolios: ResolvedPortfolio[];
  onSelectFund: (code: string) => void;
};

export function PortfolioBoard({ portfolios, onSelectFund }: Props) {
  return (
    <div className="portfolio-board">
      <p className="result-count">
        四套內部參考配置，權重合計 100%。需按客戶風險承受能力、年期及保單收費調整，並非投資建議。
      </p>
      {portfolios.map((portfolio) => (
        <article key={portfolio.id} className="portfolio-card">
          <div className="portfolio-head">
            <h2>{portfolio.name}</h2>
            <div className="fund-codes">
              <span className={`fund-type ${portfolio.style === "派息" ? "is-div" : "is-growth"}`}>
                {portfolio.style}
              </span>
              <span className="fund-risk risk-mid">{portfolio.risk}風險</span>
            </div>
          </div>
          <p className="portfolio-summary">{portfolio.summary}</p>
          <p className="portfolio-fit">{portfolio.suitedFor}</p>
          <div className="allocation-bar" aria-hidden="true">
            {portfolio.holdings.map((holding) => (
              <span
                key={holding.code}
                className={`alloc-seg ${holding.fund?.type === "dividend" ? "is-div" : "is-growth"}`}
                style={{ width: `${holding.weight}%` }}
              />
            ))}
          </div>
          <ul className="holding-list">
            {portfolio.holdings.map((holding) => (
              <li key={holding.code}>
                <button
                  type="button"
                  className="holding-btn"
                  onClick={() => onSelectFund(holding.code)}
                >
                  <span className="holding-weight">{holding.weight}%</span>
                  <span className="holding-main">
                    <span className="holding-code">{holding.code}</span>
                    <span className="holding-name">
                      {holding.fund?.name ?? "此代號目前不在目錄"}
                    </span>
                    <span className="holding-role">
                      {holding.role}
                      {holding.fund
                        ? ` · ${typeLabel(holding.fund.type)} · ${holding.fund.risk}風險 · ${holding.fund.assetClass}`
                        : " · 已下架或暫停"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
