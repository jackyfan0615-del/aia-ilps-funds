const TZ = "Asia/Hong_Kong";
const CN_QUARTER = ["", "一", "二", "三", "四"] as const;

export const QUARTER_START_MONTHS = [1, 4, 7, 10] as const;
export const QUARTER_CYCLE_LABEL = "1月1日、4月1日、7月1日、10月1日";

export type QuarterStartMonth = (typeof QUARTER_START_MONTHS)[number];

export type QuarterReview = {
  lastStart: string;
  nextStart: string;
  lastLabel: string;
  nextLabel: string;
  cycleLabel: string;
  quarterLabel: string;
  stampedLabel: string | null;
};

export type PortfolioMixRecord = {
  id: string;
  name: string;
  style: string;
  sleeves: { code: string; weight: number; role: string }[];
};

export type PortfolioQuarterStats = {
  expectedPct: number | null;
  expectedHorizon: string;
  oneYearPct: number | null;
  oneYearTotalPct: number | null;
  dividendYieldPct: number | null;
  volPct: number | null;
  maxDrawdownPct: number | null;
  riskLabel: string;
};

export type PortfolioQuarterSnapshot = {
  effectiveFrom: string;
  nextReview: string;
  reviewedAt: string;
  mix: (PortfolioMixRecord & { stats: PortfolioQuarterStats | null })[];
};

export type PortfolioQuarterFile = {
  timezone: "Asia/Hong_Kong";
  cycle: string[];
  current: PortfolioQuarterSnapshot;
  history: PortfolioQuarterSnapshot[];
};

export function hktYmd(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return { year: value("year"), month: value("month"), day: value("day") };
}

export function formatIsoDateZh(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return `${year}年${month}月${day}日`;
}

export function formatInstantZh(iso: string): string {
  return new Date(iso).toLocaleString("zh-HK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TZ,
  });
}

function toIsoDate(year: number, month: number, day = 1): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function quarterMonthFor(month: number): QuarterStartMonth {
  if (month <= 3) return 1;
  if (month <= 6) return 4;
  if (month <= 9) return 7;
  return 10;
}

function nextQuarter(year: number, month: QuarterStartMonth): { year: number; month: QuarterStartMonth } {
  if (month === 10) return { year: year + 1, month: 1 };
  return { year, month: (month + 3) as QuarterStartMonth };
}

function quarterIndex(month: QuarterStartMonth): 1 | 2 | 3 | 4 {
  return ((month - 1) / 3 + 1) as 1 | 2 | 3 | 4;
}

export function getQuarterReview(now = new Date(), stampedAt?: string | null): QuarterReview {
  const { year, month } = hktYmd(now);
  const qMonth = quarterMonthFor(month);
  const next = nextQuarter(year, qMonth);
  const lastStart = toIsoDate(year, qMonth);
  const nextStart = toIsoDate(next.year, next.month);
  return {
    lastStart,
    nextStart,
    lastLabel: formatIsoDateZh(lastStart),
    nextLabel: formatIsoDateZh(nextStart),
    cycleLabel: QUARTER_CYCLE_LABEL,
    quarterLabel: `${year}年第${CN_QUARTER[quarterIndex(qMonth)]}季`,
    stampedLabel: stampedAt ? formatInstantZh(stampedAt) : null,
  };
}

export function mixSignature(mix: PortfolioMixRecord[]): string {
  return JSON.stringify(
    mix.map((portfolio) => ({
      id: portfolio.id,
      sleeves: portfolio.sleeves.map((sleeve) => `${sleeve.code}:${sleeve.weight}:${sleeve.role}`),
    })),
  );
}

export function applyQuarterSnapshot(
  previous: PortfolioQuarterFile | null,
  next: PortfolioQuarterSnapshot,
  maxHistory = 12,
): PortfolioQuarterFile {
  const history = previous?.history ? [...previous.history] : [];
  if (previous?.current) {
    const sameQuarter = previous.current.effectiveFrom === next.effectiveFrom;
    const sameMix = mixSignature(previous.current.mix) === mixSignature(next.mix);
    if (!sameQuarter || !sameMix) {
      history.unshift(previous.current);
    }
  }
  return {
    timezone: "Asia/Hong_Kong",
    cycle: ["01-01", "04-01", "07-01", "10-01"],
    current: next,
    history: history.slice(0, maxHistory),
  };
}
