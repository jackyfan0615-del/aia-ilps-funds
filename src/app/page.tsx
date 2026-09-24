import { FundExplorer } from "@/components/FundExplorer";
import { diffCatalog, pickCatalogNotice } from "@/lib/catalog";
import { getCatalogChanges, getDataset, getFallbackDataset, getFilterOptions } from "@/lib/funds";
import { resolvePortfoliosWithStats } from "@/lib/portfolios";

export const revalidate = 21600;

type PageProps = {
  searchParams?: Promise<{ view?: string | string[] }>;
};

export default async function HomePage({ searchParams }: PageProps) {
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
  const params = searchParams ? await searchParams : undefined;
  const rawView = params?.view;
  const viewParam = Array.isArray(rawView) ? rawView[0] : rawView;
  const initialView = viewParam === "funds" ? "funds" : "portfolios";
  return (
    <FundExplorer
      assetClasses={assetClasses}
      counts={dataset.counts}
      scrapedLabel={scrapedLabel}
      product={dataset.product}
      catalogNotice={catalogNotice}
      portfolios={await resolvePortfoliosWithStats(dataset.funds)}
      initialView={initialView}
    />
  );
}
