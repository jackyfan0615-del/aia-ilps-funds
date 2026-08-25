import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { fetchAiaFunds, FUNDS_CACHE_TAG, toDataset } from "@/lib/aia";
import { diffCatalog, hasCatalogChanges } from "@/lib/catalog";
import { getFallbackDataset } from "@/lib/funds";

export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Bypass Next fetch cache for cron refresh
    const res = await fetch(
      "https://www1.aia.com.hk/CorpWS/Investment/Get/FundInfo2/?fund_cat=TMP2&fund_type=&fund_house=&fund_code=&name=&lang=zh",
      {
        headers: {
          Accept: "application/json,text/plain,*/*",
          "User-Agent":
            "Mozilla/5.0 (compatible; AIA-ILPS-Funds/1.0; +https://aia-ilps-funds.vercel.app)",
        },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      throw new Error(`AIA FundInfo2 failed: ${res.status}`);
    }

    const raw = await res.json();
    const dataset = toDataset(raw);
    const fallback = getFallbackDataset();
    const catalog = diffCatalog(fallback.funds, dataset.funds);
    const sample = dataset.funds.find((f) => f.code === "Z07") || dataset.funds[0];

    revalidateTag(FUNDS_CACHE_TAG, { expire: 0 });
    revalidatePath("/");
    revalidatePath("/api/funds");

    // Warm the tagged cache for subsequent visitors
    await fetchAiaFunds(true);

    return NextResponse.json({
      ok: true,
      updatedAt: dataset.scrapedAt,
      counts: dataset.counts,
      catalogChanged: hasCatalogChanges(catalog),
      added: catalog.added,
      removed: catalog.removed,
      renamed: catalog.renamed,
      sample: sample
        ? {
            code: sample.code,
            bidPrice: sample.bidPrice,
            valuationDate: sample.valuationDate,
          }
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[cron/update-funds]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
