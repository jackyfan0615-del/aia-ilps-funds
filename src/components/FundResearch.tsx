import type { FundNote } from "@/lib/fund-notes";

function formatDividendRate(pct: number): string {
  const text = (pct * 100)
    .toFixed(2)
    .replace(/(\.\d*?[1-9])0+$/, "$1")
    .replace(/\.00$/, "");
  return `${text}%`;
}

const LEFT_FIELDS = [
  ["thesis", "經濟驅動"],
  ["cycle", "週期位置"],
  ["valuation", "估值"],
  ["invalidation", "認錯條件"],
  ["scaleIn", "左側分注"],
] as const;

export function FundResearch({ note }: { note: FundNote }) {
  const hasFacts = Boolean(
    note.market || note.benchmark || note.tradingView || note.dividendRatePct != null,
  );
  const leftFields = LEFT_FIELDS.filter(([key]) => note[key]?.trim());

  return (
    <section className="research-panel" aria-label="基金研究備註">
      <h2 className="detail-h">研究備註</h2>
      <p className="detail-note">
        基本面＋左側：先定經濟驅動與估值，再在「惡化未完、但便宜」時分注。過往表現不代表將來表現。
      </p>
      {hasFacts ? (
        <dl className="research-grid">
          {note.market ? (
            <div>
              <dt>研究分類</dt>
              <dd>{note.market}</dd>
            </div>
          ) : null}
          {note.benchmark ? (
            <div>
              <dt>基準指數</dt>
              <dd>{note.benchmark}</dd>
            </div>
          ) : null}
          {note.tradingView ? (
            <div>
              <dt>TradingView</dt>
              <dd>{note.tradingView}</dd>
            </div>
          ) : null}
          {note.dividendRatePct != null ? (
            <div>
              <dt>研究備註派息</dt>
              <dd>{formatDividendRate(note.dividendRatePct)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {leftFields.length > 0 ? (
        <dl className="research-grid research-left">
          {leftFields.map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{note[key]}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {note.comment ? <p className="research-comment">{note.comment}</p> : null}
      <p className="detail-note">備註更新：{note.updatedAt.slice(0, 10)}</p>
    </section>
  );
}
