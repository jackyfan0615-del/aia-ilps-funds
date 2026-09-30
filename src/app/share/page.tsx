import { ShareReportView } from "@/components/ShareReportView";
import { getDataset } from "@/lib/funds";
import { latestMarketHeadline } from "@/lib/insights-content";
import { isSharePayload, parseShareSearch } from "@/lib/share-link";
import { buildShareReport, resolveMixSeries } from "@/lib/share-report";
import type { Metadata } from "next";

export const revalidate = 21600;

export const metadata: Metadata = {
  title: "季度組合摘要 · 卓達智悅 2",
  description: "客人季度組合表現摘要。連結只含基金代號與比重，不含姓名。",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SharePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const empty = !params.h && !params.holdings && !params.s && !params.q;
  if (empty) {
    return (
      <div className="insight-page">
        <h1>季度組合摘要</h1>
        <p className="empty insight-empty">
          此分享連結不完整。請由研究台的週年檢討或一頁摘要產生連結。連結不會在伺服器儲存客人姓名或組合。
        </p>
      </div>
    );
  }

  const parsed = parseShareSearch(params);
  if (!isSharePayload(parsed)) {
    return (
      <div className="insight-page">
        <h1>連結無效</h1>
        <p className="empty insight-empty">{parsed.error}</p>
      </div>
    );
  }

  const dataset = await getDataset();
  const mix = await resolveMixSeries(dataset.funds, parsed.holdings);
  const report = buildShareReport({
    mix,
    startDate: parsed.startDate,
    quarter: parsed.quarter,
    latestMarket: latestMarketHeadline(),
  });

  return <ShareReportView report={report} />;
}
