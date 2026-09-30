"use client";

import { useMemo, useState } from "react";
import type { PortfolioId, ResolvedPortfolio } from "@/lib/portfolios";
import { PORTFOLIO_NAME_BY_ID } from "@/lib/review";
import {
  buildSharePath,
  currentQuarterLabel,
  holdingsFromPortfolioId,
  parseHoldingsParam,
  type ShareHolding,
} from "@/lib/share-link";

type Props = {
  portfolios: ResolvedPortfolio[];
  initialHoldings?: ShareHolding[];
  initialStartDate?: string;
  initialName?: string;
  compact?: boolean;
};

function holdingsToDraft(holdings: ShareHolding[]): string {
  return holdings.map((item) => `${item.code} ${item.weight}`).join("\n");
}

export function ShareLinkBuilder({
  portfolios,
  initialHoldings,
  initialStartDate = "",
  initialName = "",
  compact = false,
}: Props) {
  const defaultHoldings = initialHoldings ?? holdingsFromPortfolioId("balanced");
  const [preset, setPreset] = useState<PortfolioId | "custom">(() => {
    const match = portfolios.find((item) => sameMix(item.holdings, defaultHoldings));
    return match?.id ?? "custom";
  });
  const [draft, setDraft] = useState(() => holdingsToDraft(defaultHoldings));
  const [startDate, setStartDate] = useState(initialStartDate);
  const [quarter, setQuarter] = useState(() => currentQuarterLabel());
  const [displayName, setDisplayName] = useState(initialName);
  const [note, setNote] = useState<string | null>(null);

  const parsedHoldings = useMemo(() => {
    const compactLine = draft
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/\s+/, ":"))
      .join(",");
    return parseHoldingsParam(compactLine);
  }, [draft]);

  function applyPreset(id: PortfolioId | "custom") {
    setPreset(id);
    if (id === "custom") return;
    const portfolio = portfolios.find((item) => item.id === id);
    const holdings = portfolio
      ? portfolio.holdings.map((item) => ({ code: item.code, weight: item.weight }))
      : holdingsFromPortfolioId(id);
    setDraft(holdingsToDraft(holdings));
  }

  function makePath(): string | null {
    if (!parsedHoldings) {
      setNote("請填基金代號與比重，合計 100%。一行一隻，例如 CG1 30。");
      return null;
    }
    if (!startDate) {
      setNote("請填開始投資日期。");
      return null;
    }
    try {
      return buildSharePath(
        { holdings: parsedHoldings, startDate, quarter },
        displayName,
      );
    } catch {
      setNote("季度或日期格式不正確。季度請用 2026Q3。");
      return null;
    }
  }

  function absoluteUrl(path: string): string {
    return `${window.location.origin}${path}`;
  }

  async function copyLink() {
    const path = makePath();
    if (!path) return;
    const url = absoluteUrl(path);
    try {
      await navigator.clipboard.writeText(url);
      setNote("已複製分享連結。姓名只在 # 後面，不會送到伺服器。");
    } catch {
      setNote(url);
    }
  }

  function openPreview() {
    const path = makePath();
    if (!path) return;
    window.open(absoluteUrl(path), "_blank", "noopener,noreferrer");
  }

  return (
    <div className={`share-builder${compact ? " is-compact" : ""}`}>
      <p className="summary-title">季度客人分享頁</p>
      <p className="suitability-hint">
        連結只編碼基金代號、比重、開始日同季度。選填顯示名稱只寫在網址 # 後面，伺服器同瀏覽紀錄的查詢字串都沒有客人姓名。客人可用瀏覽器列印／另存
        PDF。此頁不含佣金或內部建議。
      </p>
      <div className="review-form">
        <label className="sim-field">
          <span>參考組合</span>
          <select
            value={preset}
            onChange={(event) => applyPreset(event.target.value as PortfolioId | "custom")}
          >
            {(Object.keys(PORTFOLIO_NAME_BY_ID) as PortfolioId[]).map((id) => (
              <option key={id} value={id}>
                {PORTFOLIO_NAME_BY_ID[id]}
              </option>
            ))}
            <option value="custom">自選組合</option>
          </select>
        </label>
        <label className="sim-field">
          <span>開始投資日期</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label className="sim-field">
          <span>季度</span>
          <input
            value={quarter}
            onChange={(e) => setQuarter(e.target.value.toUpperCase())}
            placeholder="2026Q3"
            autoComplete="off"
          />
        </label>
        <label className="sim-field">
          <span>顯示名稱（選填，只放在連結 #）</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="off"
            placeholder="不會上傳伺服器"
          />
        </label>
      </div>
      <label className="sim-field share-holdings">
        <span>基金代號與比重（合計 100%）</span>
        <textarea
          rows={5}
          value={draft}
          onChange={(e) => {
            setPreset("custom");
            setDraft(e.target.value);
          }}
          spellCheck={false}
        />
      </label>
      <div className="review-actions">
        <button type="button" className="summary-btn" onClick={() => void copyLink()}>
          複製分享連結
        </button>
        <button type="button" className="expand-btn" onClick={openPreview}>
          開啟預覽
        </button>
      </div>
      {note ? <p className="suitability-hint">{note}</p> : null}
    </div>
  );
}

function sameMix(left: { code: string; weight: number }[], right: ShareHolding[]): boolean {
  const key = (items: { code: string; weight: number }[]) =>
    [...items]
      .map((item) => `${item.code.toUpperCase()}:${item.weight}`)
      .sort()
      .join("|");
  return key(left) === key(right);
}
