import Link from "next/link";

export default function FundNotFound() {
  return (
    <div className="empty-page">
      <p>找不到這隻基金。</p>
      <Link href="/" className="back-link">
        ← 返回基金目錄
      </Link>
    </div>
  );
}
