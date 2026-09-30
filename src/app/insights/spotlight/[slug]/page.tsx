import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyWhatsAppButton } from "@/components/CopyWhatsAppButton";
import { PriceTrend } from "@/components/PriceTrend";
import { fetchAiaDividends, fetchAiaFundChart } from "@/lib/aia";
import { compactChart, currencyPrefix, parseBidNumber } from "@/lib/chart";
import { FROM_CAPITAL_LABEL } from "@/lib/dividend-source";
import { estimateDividendYield } from "@/lib/dividends";
import { getFundByCode } from "@/lib/funds";
import {
  getSpotlightPost,
  INVESTMENT_DISCLAIMER_ZH,
  loadSpotlightPosts,
  paragraphsFromBody,
  spotlightWhatsAppText,
} from "@/lib/insights-content";
import { formatAbsPct, formatSignedPct } from "@/lib/portfolio-stats";
import { fundMetricsFromPoints } from "@/lib/share-report";
import type { Metadata } from "next";

export const revalidate = 21600;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return loadSpotlightPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getSpotlightPost(slug);
  if (!post) return { title: "找不到基金焦點" };
  return {
    title: `${post.fundCode} 基金焦點`,
    description: post.why.slice(0, 140) || post.title || post.fundCode,
  };
}

export default async function SpotlightPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getSpotlightPost(slug);
  if (!post) notFound();
  const fund = await getFundByCode(post.fundCode);
  if (!fund) notFound();

  const [chartResult, dividendResult] = await Promise.allSettled([
    fetchAiaFundChart(fund.code),
    fund.type === "dividend" || fund.type === "other_dividend"
      ? fetchAiaDividends(fund.code)
      : Promise.resolve([]),
  ]);
  const points = compactChart(chartResult.status === "fulfilled" ? chartResult.value : []);
  const payouts = dividendResult.status === "fulfilled" ? dividendResult.value : [];
  const bid = parseBidNumber(fund.bidPrice);
  const yieldEst = bid ? estimateDividendYield(payouts, bid) : null;
  const metrics = fundMetricsFromPoints(points, yieldEst?.pct ?? null, yieldEst?.method ?? null);
  const source = metrics.dividendSource;
  const title = post.title?.trim() || `基金焦點：${fund.code} ${fund.name}`;
  const metricLines = [
    `近1年 ${formatSignedPct(metrics.oneYearPct)}`,
    metrics.fiveYearCagrPct != null ? `5年年化 ${formatSignedPct(metrics.fiveYearCagrPct)}` : null,
    `年化波動 ${formatAbsPct(metrics.volPct)}`,
    `最大回撤 ${formatSignedPct(metrics.maxDrawdownPct)}`,
    yieldEst ? `參考股息率 ${formatAbsPct(yieldEst.pct)}` : null,
    source ? `派息來源 ${formatSignedPct(source.oneYearCapitalPct)}` : null,
  ].filter((line): line is string => line != null);

  const whatsapp = spotlightWhatsAppText({
    date: post.date,
    code: fund.code,
    name: fund.name,
    why: post.why,
    suitedFor: post.suitedFor,
    risks: post.risks,
    metrics: metricLines,
    origin: "https://aia-ilps-funds.vercel.app",
  });

  return (
    <article className="insight-page insight-article">
      <Link href="/insights/spotlight" className="back-link">
        ← 返回基金焦點
      </Link>
      <header className="insight-head">
        <p className="hero-brand">基金焦點</p>
        <p className="insight-date">{post.date}</p>
        <h1>{title}</h1>
        <p>
          <Link href={`/funds/${fund.code}`}>
            {fund.code} {fund.name}
          </Link>
        </p>
      </header>
      <div className="insight-body">
        {paragraphsFromBody(post.why).map((para, index) => (
          <p key={index}>{para}</p>
        ))}
      </div>
      <section className="year-panel">
        <h2 className="detail-h">適合客人</h2>
        <p>{post.suitedFor || "見內文。"}</p>
        <h2 className="detail-h">主要風險</h2>
        <p>{post.risks || "投資涉及風險，基金價格可升可跌。"}</p>
      </section>
      <section className="portfolio-metrics" aria-label="本站即時數據">
        <div>
          <p className="price-label">近1年</p>
          <p className={`metric-value ${(metrics.oneYearPct ?? 0) >= 0 ? "is-up" : "is-down"}`}>
            {formatSignedPct(metrics.oneYearPct)}
          </p>
        </div>
        <div>
          <p className="price-label">年化波動</p>
          <p className="metric-value">{formatAbsPct(metrics.volPct)}</p>
        </div>
        <div>
          <p className="price-label">最大回撤</p>
          <p className="metric-value is-down">{formatSignedPct(metrics.maxDrawdownPct)}</p>
        </div>
        {yieldEst ? (
          <div>
            <p className="price-label">參考股息率</p>
            <p className="metric-value is-up">{formatAbsPct(yieldEst.pct)}</p>
            {source?.fromCapital ? <p className="source-flag">{FROM_CAPITAL_LABEL}</p> : null}
          </div>
        ) : null}
      </section>
      <PriceTrend points={points} currency={currencyPrefix(fund.bidPrice)} />
      <CopyWhatsAppButton text={whatsapp} />
      <p className="share-disclaimer">{INVESTMENT_DISCLAIMER_ZH}</p>
    </article>
  );
}
