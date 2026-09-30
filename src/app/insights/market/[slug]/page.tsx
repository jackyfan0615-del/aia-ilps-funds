import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyWhatsAppButton } from "@/components/CopyWhatsAppButton";
import {
  fundMoveLabelZh,
  getMarketPost,
  INVESTMENT_DISCLAIMER_ZH,
  loadMarketPosts,
  marketWhatsAppText,
  paragraphsFromBody,
} from "@/lib/insights-content";
import { getDataset } from "@/lib/funds";
import type { Metadata } from "next";

export const revalidate = 21600;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return loadMarketPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getMarketPost(slug);
  if (!post) return { title: "找不到短評" };
  return { title: `${post.title} · 市場短評`, description: post.body.slice(0, 120) };
}

export default async function MarketPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getMarketPost(slug);
  if (!post) notFound();
  const dataset = await getDataset();
  const names = Object.fromEntries(dataset.funds.map((fund) => [fund.code, fund.name]));
  const whatsapp = marketWhatsAppText(post, {
    origin: "https://aia-ilps-funds.vercel.app",
    fundNames: names,
  });

  return (
    <article className="insight-page insight-article">
      <Link href="/insights/market" className="back-link">
        ← 返回市場短評
      </Link>
      <header className="insight-head">
        <p className="hero-brand">市場短評</p>
        <p className="insight-date">{post.date}</p>
        <h1>{post.title}</h1>
      </header>
      <div className="insight-body">
        {paragraphsFromBody(post.body).map((para, index) => (
          <p key={index}>{para}</p>
        ))}
      </div>
      {post.chart ? (
        <figure className="insight-figure">
          <Image
            src={post.chart}
            alt={`${post.title} 圖表`}
            width={960}
            height={420}
            className="insight-chart"
            unoptimized={post.chart.endsWith(".svg")}
          />
        </figure>
      ) : null}
      {post.funds.length > 0 ? (
        <section className="year-panel">
          <h2 className="detail-h">本站受影響基金</h2>
          <ul className="affected-funds">
            {post.funds.map((item) => (
              <li key={item.code}>
                <Link href={`/funds/${item.code}`} className="holding-btn">
                  <span className={`move-tag is-${item.tag}`}>{fundMoveLabelZh(item.tag)}</span>
                  <span className="holding-main">
                    <span className="holding-code">{item.code}</span>
                    <span className="holding-name">{names[item.code] ?? "目錄內名稱待核對"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <CopyWhatsAppButton text={whatsapp} />
      <p className="share-disclaimer">{INVESTMENT_DISCLAIMER_ZH}</p>
    </article>
  );
}
