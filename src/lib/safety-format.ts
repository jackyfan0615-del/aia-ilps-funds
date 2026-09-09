export type SafetyLabel = "yes" | "watch" | "none";

export type SafetyRow = {
  dd5: number;
  ret1: number | null;
  label: SafetyLabel;
  why?: string;
};

export function formatDrawdown(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) < 0.005) return "近5年高";
  return `距5年高 ${value >= 0 ? "+" : ""}${(value * 100).toFixed(0)}%`;
}

export function safetyLabelText(label: SafetyLabel | undefined): string {
  if (label === "yes") return "安全邊際";
  if (label === "watch") return "有條件";
  return "";
}
