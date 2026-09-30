import Link from "next/link";
import { fundMoveLabelZh, loadMarketPosts } from "@/lib/insights-content";

export const revalidate = 21600;

export const metadata = {
  title: "市場短評 · AIA ILPS 基金研究台",
  description: "每週市場短評：中美及環球股市、債市、黃金、能源，以及本站受影響基金。",
};

export default function MarketListPage() {
  const posts = loadMarketPosts();
  return (
    <div className="insight-page">
      <header className="insight-head">
        <p className="hero-brand">每週更新</p>
        <h1>市場短評</h1>
        <p>
          一段客人口氣，覆蓋中美及環球股市、債市、黃金、能源。新一週只要在{" "}
          <code>content/market/</code> 加一個日期檔即可。
        </p>
      </header>
      {posts.length === 0 ? (
        <p className="empty insight-empty">暫未有公開短評。範本在 content/market/_template.md，不會顯示在此列表。</p>
      ) : (
        <ul className="insight-list">
          {posts.map((post) => (
            <li key={post.slug}>
              <Link href={`/insights/market/${post.slug}`} className="insight-card">
                <p className="insight-date">{post.date}</p>
                <h2>{post.title}</h2>
                <p className="insight-excerpt">{post.body}</p>
                {post.funds.length > 0 ? (
                  <p className="insight-tags">
                    {post.funds.map((item) => (
                      <span key={item.code} className={`move-tag is-${item.tag}`}>
                        {item.code} {fundMoveLabelZh(item.tag)}
                      </span>
                    ))}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
