"use client";

import type { CatalogHistoryEvent } from "@/lib/catalog";

function formatAt(at: string) {
  return at.replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

export function CatalogNotice({ notice }: { notice: CatalogHistoryEvent }) {
  return (
    <section className="catalog-notice" aria-label="基金目錄變更">
      <p className="catalog-notice-title">AIA 目錄有變更</p>
      <p className="catalog-notice-meta">偵測時間：{formatAt(notice.at)}</p>
      {notice.added.length > 0 ? (
        <div>
          <p className="catalog-notice-label">新增 {notice.added.length} 隻</p>
          <ul>
            {notice.added.map((item) => (
              <li key={item.code}>
                <strong>{item.code}</strong> {item.name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {notice.removed.length > 0 ? (
        <div>
          <p className="catalog-notice-label">減少 {notice.removed.length} 隻</p>
          <ul>
            {notice.removed.map((item) => (
              <li key={item.code}>
                <strong>{item.code}</strong> {item.name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {notice.renamed.length > 0 ? (
        <div>
          <p className="catalog-notice-label">更名 {notice.renamed.length} 隻</p>
          <ul>
            {notice.renamed.map((item) => (
              <li key={item.code}>
                <strong>{item.code}</strong> {item.from} → {item.to}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
