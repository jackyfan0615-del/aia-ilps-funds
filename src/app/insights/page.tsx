import Link from "next/link";
import { loadMarketPosts, loadSpotlightPosts } from "@/lib/insights-content";

export const revalidate = 21600;

export const metadata = {
  title: "觀點 · AIA ILPS 基金研究台",
  description: "市場短評與基金焦點，供卓達智悅 2 銷售團隊每週／雙週更新。",
};

export default function InsightsIndexPage() {
  const market = loadMarketPosts();
  const spotlight = loadSpotlightPosts();
  return (
    <div className="insight-page">
      <header className="insight-head">
        <p className="hero-brand">AIA ILPS</p>
        <h1>觀點</h1>
        <p>每週市場短評、雙週基金焦點。內容以 repo 檔案更新，不寫真實市況到範本。</p>
      </header>
      <section className="insight-card">
        <h2>
          <Link href="/insights/market">市場短評</Link>
        </h2>
        <p className="detail-note">{market[0] ? `${market[0].date} · ${market[0].title}` : "暫未有公開短評。"}</p>
      </section>
      <section className="insight-card">
        <h2>
          <Link href="/insights/spotlight">基金焦點</Link>
        </h2>
        <p className="detail-note">
          {spotlight[0] ? `${spotlight[0].date} · ${spotlight[0].fundCode}` : "暫未有公開焦點。"}
        </p>
      </section>
    </div>
  );
}
