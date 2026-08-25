import { FundExplorer } from "@/components/FundExplorer";
import { diffCatalog, pickCatalogNotice } from "@/lib/catalog";
import { getCatalogChanges, getDataset, getFallbackDataset, getFilterOptions } from "@/lib/funds";
import { resolvePortfoliosWithStats } from "@/lib/portfolios";

export const revalidate = 21600;

export default async function HomePage() {
  const dataset = await getDataset();
  const { assetClasses } = await getFilterOptions();
  const fallback = getFallbackDataset();
  const catalogNotice = pickCatalogNotice(
    diffCatalog(fallback.funds, dataset.funds),
    getCatalogChanges().history,
    dataset.scrapedAt,
  );
  const scrapedLabel = new Date(dataset.scrapedAt).toLocaleString("zh-HK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Hong_Kong",
  });

  return (
    <>
      <FundExplorer
        funds={dataset.funds}
        assetClasses={assetClasses}
        counts={dataset.counts}
        scrapedLabel={scrapedLabel}
        product={dataset.product}
        catalogNotice={catalogNotice}
        portfolios={await resolvePortfoliosWithStats(dataset.funds)}
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
