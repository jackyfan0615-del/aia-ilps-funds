import { readFileSync } from "fs";
import path from "path";
import type { Fund, FundFilters, FundsDataset } from "./types";

let cached: FundsDataset | null = null;

export function getDataset(): FundsDataset {
  if (cached) return cached;
  const filePath = path.join(process.cwd(), "data", "funds.json");
  cached = JSON.parse(readFileSync(filePath, "utf-8")) as FundsDataset;
  return cached;
}

export function getFunds(filters: FundFilters = {}): Fund[] {
  const { funds } = getDataset();
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

export function getFilterOptions() {
  const { funds } = getDataset();
  const assetClasses = [...new Set(funds.map((f) => f.assetClass).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "zh-Hant"),
  );
  const risks = ["低", "中", "高"];
  return { assetClasses, risks };
}
