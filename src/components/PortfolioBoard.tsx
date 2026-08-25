"use client";

import Link from "next/link";
import type { ResolvedPortfolio } from "@/lib/portfolios";
import { formatAbsPct, formatSignedPct, riskBadgeClass } from "@/lib/portfolio-stats";
import { typeLabel } from "@/lib/labels";

type Props = {
  portfolios: ResolvedPortfolio[];
};

export function PortfolioBoard({ portfolios }: Props) {
  return (
    <div className="portfolio-board">
      <p className="result-count">
        四套內部參考配置，同一套原則：先定目標（派息或增值），再沿風險階梯由防守（現金／短債）→ 核心（平衡／多元）→ 衛星（股票／主題）配 5 隻基金，權重合計 100%。
      </p>
      <p className="portfolio-disclaimer">
        參考預期回報按各基金 AIA 過往賣出價加權；派息組合另計現金股息率（未扣保單收費）。風險按年化波動及最大回撤。過往表現不代表將來表現，派息不保證。
      </p>
      {portfolios.map((portfolio) => (
        <article key={portfolio.id} className="portfolio-card">
          <div className="portfolio-head">
            <h2>{portfolio.name}</h2>
            <div className="fund-codes">
              <span className={`fund-type ${portfolio.style === "派息" ? "is-div" : "is-growth"}`}>
                {portfolio.style}
              </span>
              <span className={`fund-risk ${riskBadgeClass(portfolio.stats.riskLabel)}`}>
                {portfolio.stats.riskLabel}風險
              </span>
            </div>
          </div>

          <div className="portfolio-metrics">
            <div>
              <p className="price-label">參考預期回報</p>
              <p className={`metric-value ${ (portfolio.stats.expectedPct ?? 0) >= 0 ? "is-up" : "is-down"}`}>
                {formatSignedPct(portfolio.stats.expectedPct)}
              </p>
              <p className="metric-sub">
                {portfolio.style === "派息" && portfolio.stats.dividendYieldPct != null
                  ? "近1年價格 + 股息率"
                  : `按過去${portfolio.stats.expectedHorizon}`}
                {portfolio.style !== "派息" && portfolio.stats.threeYearCagrPct != null
                  ? ` · 3年 ${formatSignedPct(portfolio.stats.threeYearCagrPct)}`
                  : ""}
              </p>
            </div>
            {portfolio.style === "派息" ? (
              <div>
                <p className="price-label">參考股息率</p>
                <p className="metric-value is-up">{formatAbsPct(portfolio.stats.dividendYieldPct)}</p>
                <p className="metric-sub">
                  {portfolio.stats.dividendYieldMethod === "annualized"
                    ? "部分基金按近月年化"
                    : "AIA 現金派息／最新賣出價"}
                </p>
              </div>
            ) : null}
            <div>
              <p className="price-label">{portfolio.style === "派息" ? "近1年含息" : "近1年"}</p>
              <p className={`metric-value ${ ((portfolio.style === "派息" ? portfolio.stats.oneYearTotalPct : portfolio.stats.oneYearPct) ?? 0) >= 0 ? "is-up" : "is-down"}`}>
                {formatSignedPct(
                  portfolio.style === "派息" ? portfolio.stats.oneYearTotalPct : portfolio.stats.oneYearPct,
                )}
              </p>
              <p className="metric-sub">
                {portfolio.style === "派息"
                  ? `價格 ${formatSignedPct(portfolio.stats.oneYearPct)}`
                  : "過往總回報"}
              </p>
            </div>
            <div>
              <p className="price-label">年化波動</p>
              <p className="metric-value">{formatAbsPct(portfolio.stats.volPct)}</p>
              <p className="metric-sub">風險水平</p>
            </div>
            <div>
              <p className="price-label">最大回撤</p>
              <p className="metric-value is-down">{formatSignedPct(portfolio.stats.maxDrawdownPct)}</p>
              <p className="metric-sub">組合高峰至低位</p>
            </div>
          </div>

          <p className="portfolio-principle">{portfolio.principle}</p>
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
                {holding.fund ? (
                  <Link href={`/funds/${holding.code}`} className="holding-btn">
                    <span className="holding-weight">{holding.weight}%</span>
                    <span className="holding-main">
                      <span className="holding-code">{holding.code}</span>
                      <span className="holding-name">{holding.fund.name}</span>
                      <span className="holding-role">
                        {holding.role}
                        {` · ${typeLabel(holding.fund.type)} · ${holding.fund.risk}風險 · 近1年 ${formatSignedPct(holding.oneYearPct)}`}
                        {holding.dividendYieldPct != null
                          ? ` · 股息率 ${formatAbsPct(holding.dividendYieldPct)}`
                          : ""}
                      </span>
                    </span>
                  </Link>
                ) : (
                  <div className="holding-btn is-disabled">
                    <span className="holding-weight">{holding.weight}%</span>
                    <span className="holding-main">
                      <span className="holding-code">{holding.code}</span>
                      <span className="holding-name">此代號目前不在目錄</span>
                      <span className="holding-role">{holding.role} · 已下架或暫停</span>
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
