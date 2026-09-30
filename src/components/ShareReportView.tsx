"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatSignedPct } from "@/lib/portfolio-stats";
import { parseShareHash } from "@/lib/share-link";
import type { ShareReport } from "@/lib/share-report";

type Props = {
  report: ShareReport;
};

export function ShareReportView({ report }: Props) {
  const [displayName, setDisplayName] = useState("");

  /* eslint-disable react-hooks/set-state-in-effect -- hash is client-only and must not ship in SSR HTML */
  useEffect(() => {
    setDisplayName(parseShareHash(window.location.hash));
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <article className="share-page">
      <header className="share-hero">
        <p className="hero-brand">AIA 卓達智悅 2</p>
        <p className="share-kicker">季度組合摘要 · {report.quarterLabelZh}</p>
        <h1 className="hero-title">{displayName ? `${displayName} · ${report.mixName}` : report.mixName}</h1>
        <p className="hero-sub">
          開始 {report.startDate} · 資料截至 {report.asOfLabel} · {report.style}
        </p>
      </header>

      <div className="share-toolbar no-print">
        <button type="button" className="summary-btn" onClick={() => window.print()}>
          列印／另存 PDF
        </button>
      </div>

      <section className="portfolio-metrics" aria-label="組合表現">
        <div>
          <p className="price-label">開始至今</p>
          <p className={`metric-value ${(report.sinceStartPct ?? 0) >= 0 ? "is-up" : "is-down"}`}>
            {formatSignedPct(report.sinceStartPct)}
          </p>
          <p className="metric-sub">組合加權賣出價 NAV</p>
        </div>
        <div>
          <p className="price-label">{report.quarterLabelZh}</p>
          <p className={`metric-value ${(report.quarterPct ?? 0) >= 0 ? "is-up" : "is-down"}`}>
            {formatSignedPct(report.quarterPct)}
          </p>
          <p className="metric-sub">本季至今（或該季整段）</p>
        </div>
        <div>
          <p className="price-label">同期扣費後參考</p>
          <p className={`metric-value ${(report.afterFeePct ?? 0) >= 0 ? "is-up" : "is-down"}`}>
            {formatSignedPct(report.afterFeePct)}
          </p>
          <p className="metric-sub">{report.afterFeeNote}</p>
        </div>
        <div>
          <p className="price-label">現時回撤</p>
          <p className="metric-value is-down">{formatSignedPct(report.currentDrawdownPct)}</p>
          <p className="metric-sub">由開始後高位計</p>
        </div>
      </section>

      {report.historyLimited ? (
        <p className="drawdown-note">開始日早於部分基金有價的日子，回報只用現有走勢。</p>
      ) : null}
      {report.dataProvisional || report.failedCodes.length > 0 ? (
        <p className="fee-note">
          {report.failedCodes.length > 0
            ? `部分基金數據暫未能更新：${report.failedCodes.join("、")}。`
            : "部分走勢未能更新，數字僅供參考。"}
        </p>
      ) : null}

      <section className="year-panel">
        <h2 className="detail-h">成分基金</h2>
        <div className="price-table-wrap">
          <table className="price-table">
            <thead>
              <tr>
                <th>代號</th>
                <th>基金</th>
                <th>比重</th>
                <th>開始至今</th>
                <th>{report.quarterLabelZh}</th>
              </tr>
            </thead>
            <tbody>
              {report.holdings.map((holding) => (
                <tr key={holding.code}>
                  <td>
                    <Link href={`/funds/${holding.code}`}>{holding.code}</Link>
                  </td>
                  <td>{holding.name}</td>
                  <td>{holding.weight}%</td>
                  <td className={(holding.sinceStartPct ?? 0) >= 0 ? "is-up" : "is-down"}>
                    {formatSignedPct(holding.sinceStartPct)}
                  </td>
                  <td className={(holding.quarterPct ?? 0) >= 0 ? "is-up" : "is-down"}>
                    {formatSignedPct(holding.quarterPct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="year-panel">
        <h2 className="detail-h">最新市場短評</h2>
        {report.latestMarket ? (
          <p>
            <Link href={report.latestMarket.href}>{report.latestMarket.title}</Link>
            <span className="metric-sub"> · {report.latestMarket.date}</span>
          </p>
        ) : (
          <p className="detail-note">暫未有公開市場短評。</p>
        )}
      </section>

      <p className="share-disclaimer">{report.disclaimer}</p>
      <p className="detail-note">
        實際保單單位價格未必等於網站賣出價。扣費後參考只減保單手續費，並非該保單對帳單。過往表現不代表將來表現。
      </p>
    </article>
  );
}
