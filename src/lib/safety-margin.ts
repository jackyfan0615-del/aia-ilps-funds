import { readFileSync } from "fs";
import path from "path";
import type { SafetyLabel, SafetyRow } from "./safety-format";

export type { SafetyLabel, SafetyRow };

export type SafetyMarginFile = {
  asOf: string;
  method: string;
  yesCount: number;
  watchCount: number;
  funds: Record<string, SafetyRow>;
};

export function getSafetyMarginFile(): SafetyMarginFile {
  const filePath = path.join(process.cwd(), "data", "safety-margin.json");
  return JSON.parse(readFileSync(filePath, "utf-8")) as SafetyMarginFile;
}

export function getSafetyRow(code: string): SafetyRow | undefined {
  return getSafetyMarginFile().funds[code.trim().toUpperCase()];
}

export function getSafetyIndex(): Record<
  string,
  { label: SafetyLabel; dd5: number }
> {
  const index: Record<string, { label: SafetyLabel; dd5: number }> = {};
  for (const [code, row] of Object.entries(getSafetyMarginFile().funds)) {
    index[code] = { label: row.label, dd5: row.dd5 };
  }
  return index;
}
