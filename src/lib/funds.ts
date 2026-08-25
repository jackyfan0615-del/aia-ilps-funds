import { readFileSync } from "fs";
import path from "path";
import { fetchAiaFunds } from "./aia";
import type { Fund, FundFilters, FundsDataset } from "./types";

function readFallbackDataset(): FundsDataset {
  const filePath = path.join(process.cwd(), "data", "funds.json");
  return JSON.parse(readFileSync(filePath, "utf-8")) as FundsDataset;
}

export async function getDataset(): Promise<FundsDataset> {
  try {
    return await fetchAiaFunds();
  } catch (error) {
    console.error("[funds] AIA live fetch failed, using fallback JSON", error);
    return readFallbackDataset();
  }
}

export async function getFunds(filters: FundFilters = {}): Promise<Fund[]> {
  const { funds } = await getDataset();
  const q = filters.q?.trim().toLowerCase() ?? "";
  const type = filters.type ?? "all";
  const risk = filters.risk ?? "";
  const assetClass = filters.assetClass ?? "";

  return funds.filter((fund) => {
    if (type === "growth" && fund.type !== "growth") return false;
    if (type === "dividend" && fund.type !== "dividend") return false;
    if (risk && fund.risk !== risk) return false;
    if (assetClass && fund.assetClass !== assetClass) return false;
    if (!q) return true;
    const haystack = [
      fund.code,
      fund.name,
      fund.manager,
      fund.assetClass,
      fund.risk,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export async function getFilterOptions() {
  const { funds } = await getDataset();
  const assetClasses = [
    ...new Set(funds.map((f) => f.assetClass).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "zh-Hant"));
  const risks = ["低", "中", "高"];
  return { assetClasses, risks };
}
