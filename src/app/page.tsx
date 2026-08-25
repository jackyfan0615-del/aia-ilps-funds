import { FundExplorer } from "@/components/FundExplorer";
import { getDataset, getFilterOptions } from "@/lib/funds";

export const revalidate = 21600;

export default async function HomePage() {
  const dataset = await getDataset();
  const { assetClasses } = await getFilterOptions();

  return (
    <>
      <FundExplorer
        funds={dataset.funds}
        assetClasses={assetClasses}
        counts={dataset.counts}
        scrapedAt={dataset.scrapedAt}
        product={dataset.product}
      />
      <footer className="site-footer">
        資料來源：
        <a href={dataset.source} target="_blank" rel="noopener noreferrer">
          AIA 投資選擇資訊
        </a>
        。本工具僅供內部銷售參考，並非投資建議。過往表現不代表將來表現。
      </footer>
    </>
  );
}
