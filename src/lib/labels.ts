import type { Fund } from "./types";

export function typeLabel(type: Fund["type"]): string {
  if (type === "dividend") return "派息";
  if (type === "other_dividend") return "派息（非Z）";
  return "增長";
}
