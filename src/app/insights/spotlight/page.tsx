import Link from "next/link";
import { loadSpotlightPosts } from "@/lib/insights-content";
import { getFallbackDataset } from "@/lib/funds";

export const revalidate = 21600;

export const metadata = {
  title: "基金焦點 · AIA ILPS 基金研究台",
  description: "雙週基金焦點：為何留意、適合客人、主要風險，並帶入本站即時數據。",
};

export default function SpotlightListPage() {
  const posts = loadSpotlightPosts();
  const names = Object.fromEntries(getFallbackDataset().funds.map((fund) => [fund.code, fund.name]));
  return (
    <div className="insight-page">
      <header className="insight-head">
        <p className="hero-brand">雙週更新</p>
        <h1>基金焦點</h1>
        <p>
          點出一隻值得留意的投資選擇。新一篇只要在 <code>content/spotlight/</code> 加檔，頁面會自動讀本站回報、波動與回撤。
        </p>
      </header>
      {posts.length === 0 ? (
        <p className="empty insight-empty">暫未有公開焦點。範本在 content/spotlight/_template.md，不會顯示在此列表。</p>
      ) : (
        <ul className="insight-list">
          {posts.map((post) => (
            <li key={post.slug}>
              <Link href={`/insights/spotlight/${post.slug}`} className="insight-card">
                <p className="insight-date">{post.date}</p>
                <h2>
                  {post.fundCode} {names[post.fundCode] ?? ""}
                </h2>
                <p className="insight-excerpt">{post.why || post.title}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
