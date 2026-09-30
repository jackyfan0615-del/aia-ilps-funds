"use client";

import { useEffect, useMemo, useState } from "react";
import { POLICY_FEE_EARLY, POLICY_FEE_LATER } from "@/lib/policy-fees";
import { formatSignedPct, formatZhYearMonth } from "@/lib/portfolio-stats";
import type { PortfolioId, ResolvedPortfolio } from "@/lib/portfolios";
import { PORTFOLIO_NAME_BY_ID, buildReviewSnapshot } from "@/lib/review";
import {
  REVIEW_CSV_HELP_ZH,
  loadReviewRecords,
  newReviewRecord,
  parseReviewCsv,
  removeReviewRecord,
  saveReviewRecords,
  serializeReviewCsv,
  upsertReviewRecord,
  type ReviewRecord,
} from "@/lib/review-storage";

type Props = {
  portfolios: ResolvedPortfolio[];
};

export function ReviewBoard({ portfolios }: Props) {
  const [records, setRecords] = useState<ReviewRecord[]>([]);
  const [draft, setDraft] = useState<ReviewRecord>(() => newReviewRecord());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- restore localStorage after mount */
  useEffect(() => {
    const stored = loadReviewRecords();
    setRecords(stored);
    setReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (ready) saveReviewRecords(records);
  }, [ready, records]);

  const selected = records.find((item) => item.id === selectedId) ?? null;
  const portfolio = selected
    ? (portfolios.find((item) => item.id === selected.portfolioId) ?? null)
    : null;
  const snapshot = useMemo(() => {
    if (!selected || !portfolio) return null;
    const start = Date.parse(`${selected.startDate}T00:00:00+08:00`);
    if (!Number.isFinite(start)) return null;
    return buildReviewSnapshot(portfolio, start);
  }, [selected, portfolio]);

  function saveDraft() {
    if (!draft.name.trim() || !draft.anniversary || !draft.startDate) {
      setImportNote("請填姓名、週年日與開始日期。");
      return;
    }
    const next = { ...draft, name: draft.name.trim() };
    setRecords((current) => upsertReviewRecord(current, next));
    setSelectedId(next.id);
    setImportNote("已儲存在這個瀏覽器（不會上傳伺服器）。");
  }

  function onImport(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const { records: incoming, errors } = parseReviewCsv(text);
      if (incoming.length === 0) {
        setImportNote(errors[0] ?? "沒有可匯入的列。");
        return;
      }
      setRecords((current) => [...current, ...incoming]);
      setSelectedId(incoming[0].id);
      setImportNote(
        `已匯入 ${incoming.length} 位${errors.length > 0 ? `，略過 ${errors.length} 行` : ""}。只存在這個瀏覽器。`,
      );
    };
    reader.readAsText(file);
  }

  function exportCsv() {
    const blob = new Blob([serializeReviewCsv(records)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ilps-anniversary-review.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="review-board">
      <section className="suitability" aria-labelledby="review-title">
        <h2 id="review-title" className="suitability-title">
          週年檢討
        </h2>
        <p className="suitability-lead">
          客戶名單只存在這個瀏覽器的 localStorage，可用 CSV 匯入／匯出。不要把保單號碼或身分證寫進來。
        </p>
        <pre className="review-help">{REVIEW_CSV_HELP_ZH}</pre>
        <div className="review-actions">
          <label className="review-file">
            匯入 CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onImport(file);
                event.target.value = "";
              }}
            />
          </label>
          <button type="button" className="expand-btn" onClick={exportCsv} disabled={records.length === 0}>
            匯出 CSV
          </button>
        </div>
        {importNote ? <p className="suitability-hint">{importNote}</p> : null}

        <div className="review-form">
          <label className="sim-field">
            <span>客戶姓名</span>
            <input
              value={draft.name}
              onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
              autoComplete="off"
            />
          </label>
          <label className="sim-field">
            <span>保單週年日</span>
            <input
              type="date"
              value={draft.anniversary}
              onChange={(e) =>
                setDraft((current) => ({
                  ...current,
                  anniversary: e.target.value,
                  startDate: current.startDate || e.target.value,
                }))
              }
            />
          </label>
          <label className="sim-field">
            <span>開始投資日期</span>
            <input
              type="date"
              value={draft.startDate}
              onChange={(e) => setDraft((current) => ({ ...current, startDate: e.target.value }))}
            />
          </label>
          <label className="sim-field">
            <span>參考組合</span>
            <select
              value={draft.portfolioId}
              onChange={(e) =>
                setDraft((current) => ({ ...current, portfolioId: e.target.value as PortfolioId }))
              }
            >
              {(Object.keys(PORTFOLIO_NAME_BY_ID) as PortfolioId[]).map((id) => (
                <option key={id} value={id}>
                  {PORTFOLIO_NAME_BY_ID[id]}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="summary-btn" onClick={saveDraft}>
            儲存到本機
          </button>
        </div>
      </section>

      <ul className="review-list">
        {records.map((record) => (
          <li key={record.id}>
            <button
              type="button"
              className={record.id === selectedId ? "is-on" : undefined}
              onClick={() => {
                setSelectedId(record.id);
                setDraft(record);
              }}
            >
              <strong>{record.name}</strong>
              <span>
                {PORTFOLIO_NAME_BY_ID[record.portfolioId]} · 週年 {record.anniversary}
              </span>
            </button>
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setRecords((current) => removeReviewRecord(current, record.id));
                if (selectedId === record.id) {
                  setSelectedId(null);
                  setDraft(newReviewRecord());
                }
              }}
            >
              刪除
            </button>
          </li>
        ))}
        {records.length === 0 ? <li className="empty">尚未有本機客戶紀錄。</li> : null}
      </ul>

      {selected && portfolio && snapshot ? (
        <article className="portfolio-card" data-review={selected.portfolioId}>
          <div className="portfolio-head">
            <h2>
              {selected.name} · {portfolio.name}
            </h2>
          </div>
          <p className="portfolio-fit">
            開始 {selected.startDate} · 已過約 {snapshot.yearsElapsed.toFixed(1)} 年 · 週年 {selected.anniversary}
          </p>
          <div className="portfolio-metrics">
            <div>
              <p className="price-label">開始至今（組合 NAV）</p>
              <p className={`metric-value ${(snapshot.actualPct ?? 0) >= 0 ? "is-up" : "is-down"}`}>
                {formatSignedPct(snapshot.actualPct)}
              </p>
              <p className="metric-sub">
                {snapshot.navFrom && snapshot.navTo
                  ? `${formatZhYearMonth(snapshot.navFrom)}至${formatZhYearMonth(snapshot.navTo)}`
                  : "走勢不足"}
              </p>
            </div>
            <div>
              <p className="price-label">同期扣費後參考</p>
              <p className={`metric-value ${(snapshot.expectedPct ?? 0) >= 0 ? "is-up" : "is-down"}`}>
                {formatSignedPct(snapshot.expectedPct)}
              </p>
              <p className="metric-sub">
                按{portfolio.stats.expectedHorizon} {formatSignedPct(portfolio.stats.expectedPct)}，減首 5 年{" "}
                {(POLICY_FEE_EARLY * 100).toFixed(2)}%／其後 {(POLICY_FEE_LATER * 100).toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="price-label">現時回撤</p>
              <p className="metric-value is-down">{formatSignedPct(snapshot.currentDrawdownPct)}</p>
              <p className="metric-sub">由開始後高位計</p>
            </div>
            <div>
              <p className="price-label">歷史最大回撤</p>
              <p className="metric-value is-down">{formatSignedPct(portfolio.stats.maxDrawdownPct)}</p>
              <p className="metric-sub">組合參考</p>
            </div>
          </div>
          {snapshot.historyLimited ? (
            <p className="drawdown-note">開始日早於部分基金有價的日子，實際回報只用現有走勢。</p>
          ) : null}
          {snapshot.removedCodes.length > 0 ? (
            <p className="suitability-caution">已不在 AIA 目錄：{snapshot.removedCodes.join("、")}</p>
          ) : null}
          {snapshot.staleCodes.length > 0 || snapshot.dataProvisional ? (
            <p className="fee-note">
              {snapshot.staleCodes.length > 0
                ? `數據偏舊或缺失：${snapshot.staleCodes.join("、")}。`
                : "部分走勢未能更新。"}
            </p>
          ) : null}
          <div className={`review-advice is-${snapshot.advice.action}`}>
            <p className="review-action">{adviceLabel(snapshot.advice.action)}</p>
            <p>
              <strong>{snapshot.advice.headline}</strong>
            </p>
            <p>{snapshot.advice.detail}</p>
          </div>
          <ul className="holding-list">
            {portfolio.holdings.map((holding) => (
              <li key={holding.code}>
                <div className={`holding-btn ${holding.fund ? "" : "is-disabled"}`}>
                  <span className="holding-weight">{holding.weight}%</span>
                  <span className="holding-main">
                    <span className="holding-code">{holding.code}</span>
                    <span className="holding-name">{holding.fund?.name ?? "此代號目前不在目錄"}</span>
                    <span className="holding-role">
                      {holding.fund
                        ? `近1年 ${holding.oneYearPct == null ? "數據待更新" : formatSignedPct(holding.oneYearPct)}`
                        : "已下架或暫停"}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <p className="sim-disclaimer">
            實際保單單位價格未必等於網站賣出價。扣費後參考只減約{" "}
            {(POLICY_FEE_EARLY * 100).toFixed(2)}%／{(POLICY_FEE_LATER * 100).toFixed(2)}
            % 手續費，並非該客戶保單對帳單。
          </p>
        </article>
      ) : null}
    </div>
  );
}

function adviceLabel(action: "stay" | "rebalance" | "switch"): string {
  if (action === "stay") return "建議：留守";
  if (action === "rebalance") return "建議：再平衡／換走下架基金";
  return "建議：考慮轉套";
}
