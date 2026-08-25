import Link from "next/link";
import { notFound } from "next/navigation";
import { PriceTrend } from "@/components/PriceTrend";
import { aiaDetailsUrl, fetchAiaFundChart, fetchAiaFundExtras } from "@/lib/aia";
import { compactChart, currencyPrefix } from "@/lib/chart";
import { getFundByCode } from "@/lib/funds";
import { typeLabel } from "@/lib/labels";
import type { Metadata } from "next";

export const revalidate = 21600;

type PageProps = {
  params: Promise<{ code: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const fund = await getFundByCode(code);
  if (!fund) return { title: "找不到基金" };
  return {
    title: `${fund.code} ${fund.name} · 價格走勢`,
    description: `${fund.name}（${fund.code}）賣出價走勢、年度回報與近期估值。`,
  };
}

function riskClass(risk: string) {
  if (risk === "高") return "risk-high";
  if (risk === "中") return "risk-mid";
  return "risk-low";
}

export default async function FundDetailPage({ params }: PageProps) {
  const { code } = await params;
  const fund = await getFundByCode(code);
  if (!fund) notFound();

  const [chartResult, extrasResult] = await Promise.allSettled([
    fetchAiaFundChart(fund.code),
    fetchAiaFundExtras(fund.code),
  ]);
  const points = compactChart(
    chartResult.status === "fulfilled" ? chartResult.value : [],
  );
  const extras =
    extrasResult.status === "fulfilled"
      ? extrasResult.value
      : { isin: "", dailyChange: "", performanceAsOf: "", yearReturns: [] };

  const daily = Number.parseFloat(extras.dailyChange);
  const dailyUp = Number.isFinite(daily) ? daily >= 0 : null;
  const currency = currencyPrefix(fund.bidPrice);

  return (
    <article className="fund-detail">
      <Link href="/" className="back-link">
        ← 返回基金目錄
      </Link>

      <header className="detail-hero">
        <div className="fund-codes">
          <span className="fund-code">{fund.code}</span>
          <span className={`fund-type ${fund.type === "dividend" ? "is-div" : "is-growth"}`}>
            {typeLabel(fund.type)}
          </span>
          <span className={`fund-risk ${riskClass(fund.risk)}`}>{fund.risk}風險</span>
        </div>
        <h1 className="detail-title">{fund.name}</h1>
        <p className="detail-sub">
          {fund.assetClass || "—"}
          {fund.manager ? ` · ${fund.manager}` : ""}
          {fund.aum ? ` · 基金規模 ${fund.aum}` : ""}
        </p>
        <div className="detail-price-block">
          <div>
            <p className="price-label">最新賣出價</p>
            <p className="detail-price">{fund.bidPrice || "—"}</p>
            <p className="price-date">{fund.valuationDate || "—"}</p>
          </div>
          {Number.isFinite(daily) ? (
            <div>
              <p className="price-label">當日變動</p>
              <p className={`trend-change ${dailyUp ? "is-up" : "is-down"}`}>
                {dailyUp ? "+" : ""}
                {daily.toFixed(2)}%
              </p>
            </div>
          ) : null}
        </div>
      </header>

      <PriceTrend points={points} currency={currency} />

      {extras.yearReturns.length > 0 ? (
        <section className="year-panel">
          <h2 className="detail-h">年度回報</h2>
          {extras.performanceAsOf ? (
            <p className="detail-note">表現截至 {extras.performanceAsOf}</p>
          ) : null}
          <div className="year-grid">
            {extras.yearReturns.map((row) => (
              <div key={row.year} className="year-cell">
                <span>{row.year}</span>
                <strong className={row.negative ? "is-down" : "is-up"}>{row.value}</strong>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <p className="detail-note">
        {extras.isin ? `ISIN ${extras.isin} · ` : ""}
        價格為 AIA 公布之賣出價走勢，過往表現不代表將來表現。
        {" "}
        <a href={aiaDetailsUrl(fund.code)} target="_blank" rel="noopener noreferrer">
          查看 AIA 官方詳情
        </a>
      </p>
      <footer className="site-footer">本工具僅供內部銷售參考，並非投資建議。</footer>
    </article>
  );
}
