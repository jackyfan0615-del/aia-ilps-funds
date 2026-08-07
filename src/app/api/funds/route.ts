import { NextRequest, NextResponse } from "next/server";
import { getDataset, getFilterOptions, getFunds } from "@/lib/funds";
import type { FundFilters } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const filters: FundFilters = {
    q: searchParams.get("q") ?? undefined,
    type: (searchParams.get("type") as FundFilters["type"]) ?? "all",
    risk: searchParams.get("risk") ?? undefined,
    assetClass: searchParams.get("assetClass") ?? undefined,
  };

  const dataset = getDataset();
  const funds = getFunds(filters);
  const options = getFilterOptions();

  return NextResponse.json({
    product: dataset.product,
    source: dataset.source,
    scrapedAt: dataset.scrapedAt,
    counts: dataset.counts,
    options,
    total: funds.length,
    funds,
  });
}
