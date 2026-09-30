import Link from "next/link";

export default function InsightNotFound() {
  return (
    <div className="empty-page">
      <p>找不到這篇內容。</p>
      <Link href="/insights" className="back-link">
        ← 返回觀點
      </Link>
    </div>
  );
}
