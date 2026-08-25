"use client";

import { useDeferredValue, useMemo, useState } from "react";
import type { Fund } from "@/lib/types";
import type { CatalogHistoryEvent } from "@/lib/catalog";
import { CatalogNotice } from "./CatalogNotice";
import { FundRow } from "./FundRow";

type Props = {
  funds: Fund[];
  assetClasses: string[];
  counts: {
    total: number;
    growth: number;
    dividend: number;
    other: number;
  };
  scrapedAt: string;
  product: string;
  catalogNotice: CatalogHistoryEvent | null;
};

export function FundExplorer({
  funds,
  assetClasses,
  counts,
  scrapedAt,
  product,
  catalogNotice,
}: Props) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | "growth" | "dividend">("all");
  const [risk, setRisk] = useState("");
  const [assetClass, setAssetClass] = useState("");
  const deferredQ = useDeferredValue(q);

  const filtered = useMemo(() => {
    const query = deferredQ.trim().toLowerCase();
    return funds.filter((fund) => {
      if (type === "growth" && fund.type !== "growth") return false;
      if (type === "dividend" && fund.type !== "dividend") return false;
      if (risk && fund.risk !== risk) return false;
      if (assetClass && fund.assetClass !== assetClass) return false;
      if (!query) return true;
      const haystack = [fund.code, fund.name, fund.manager, fund.assetClass]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [funds, deferredQ, type, risk, assetClass]);

  const scrapedLabel = new Date(scrapedAt).toLocaleString("zh-HK", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="explorer">
      <section className="hero">
        <p className="hero-brand">AIA ILPS</p>
        <h1 className="hero-title">基金研究台</h1>
        <p className="hero-sub">
          {product} · 增長 {counts.growth} · 派息 Z 字 {counts.dividend}
        </p>
        <p className="hero-meta">資料更新：{scrapedLabel} · 目錄隨 AIA 增減自動同步</p>
      </section>

      {catalogNotice ? <CatalogNotice notice={catalogNotice} /> : null}

      <section className="toolbar" aria-label="篩選">
        <label className="search-field">
          <span className="sr-only">搜尋基金</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋代號、名稱、經理…"
            autoComplete="off"
          />
        </label>

        <div className="type-tabs" role="tablist" aria-label="基金類型">
          {(
            [
              ["all", `全部 ${counts.total}`],
              ["growth", `增長 ${counts.growth}`],
              ["dividend", `派息 Z ${counts.dividend}`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={type === value}
              className={type === value ? "active" : undefined}
              onClick={() => setType(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="select-row">
          <label>
            <span>風險</span>
            <select value={risk} onChange={(e) => setRisk(e.target.value)}>
              <option value="">全部風險</option>
              <option value="低">低</option>
              <option value="中">中</option>
              <option value="高">高</option>
            </select>
          </label>
          <label>
            <span>資產類別</span>
            <select
              value={assetClass}
              onChange={(e) => setAssetClass(e.target.value)}
            >
              <option value="">全部類別</option>
              {assetClasses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <p className="result-count">顯示 {filtered.length} 隻投資選擇</p>

      <div className="fund-list">
        {filtered.map((fund) => (
          <FundRow key={fund.code} fund={fund} />
        ))}
        {filtered.length === 0 ? (
          <p className="empty">沒有符合條件的基金，試試清除篩選。</p>
        ) : null}
      </div>
    </div>
  );
}
