import { parsePortfolioId, PORTFOLIO_NAME_BY_ID, type ReviewSnapshot } from "./review";
import type { PortfolioId } from "./portfolios";

export const REVIEW_STORAGE_KEY = "ilps-review-clients-v1";

export const REVIEW_CSV_COLUMNS = ["name", "anniversary", "portfolio", "start_date"] as const;

export const REVIEW_CSV_HELP_ZH = `週年檢討 CSV 欄位（可用 Notion CRM 匯出後另存）：
name          客戶姓名（必填；亦接受「姓名」「客戶」「Client」）
anniversary   保單週年日（必填；YYYY-MM-DD 或 D/M/YYYY；亦接受「週年」「保單週年」「Anniversary」）
portfolio     組合（必填）：派息入息／穩健增長／均衡核心／進取增長，或 income／steady／balanced／growth
start_date    開始投資日期（選填；空白則用週年日。亦接受「開始日期」「Policy Date」「Start」）`;

export type ReviewRecord = {
  id: string;
  name: string;
  anniversary: string;
  portfolioId: PortfolioId;
  startDate: string;
};

type HeaderMap = Record<(typeof REVIEW_CSV_COLUMNS)[number], string[]>;

const HEADERS: HeaderMap = {
  name: ["name", "姓名", "客戶", "客户", "client", "client name", "客戶姓名"],
  anniversary: [
    "anniversary",
    "anniversary_date",
    "週年",
    "周年",
    "保單週年",
    "保单周年",
    "policy anniversary",
  ],
  portfolio: ["portfolio", "組合", "组合", "mix"],
  start_date: ["start_date", "start", "開始日期", "开始日期", "policy date", "policydate"],
};

export function parseFlexibleDate(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (validYmd(year, month, day)) return isoDate(year, month, day);
  }
  const dmy = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (validYmd(year, month, day)) return isoDate(year, month, day);
  }
  return null;
}

function validYmd(year: number, month: number, day: number): boolean {
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function dateToTs(iso: string): number | null {
  const parsed = parseFlexibleDate(iso);
  if (!parsed) return null;
  const [year, month, day] = parsed.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out;
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase();
}

function mapHeaders(headerRow: string[]): Partial<Record<(typeof REVIEW_CSV_COLUMNS)[number], number>> {
  const map: Partial<Record<(typeof REVIEW_CSV_COLUMNS)[number], number>> = {};
  headerRow.forEach((cell, index) => {
    const key = normalizeHeader(cell);
    (Object.keys(HEADERS) as (typeof REVIEW_CSV_COLUMNS)[number][]).forEach((field) => {
      if (map[field] == null && HEADERS[field].some((alias) => alias.toLowerCase() === key)) {
        map[field] = index;
      }
    });
  });
  return map;
}

export function parseReviewCsv(text: string): { records: ReviewRecord[]; errors: string[] } {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return { records: [], errors: ["空白檔案"] };

  const header = splitCsvLine(lines[0]);
  const cols = mapHeaders(header);
  if (cols.name == null || cols.anniversary == null || cols.portfolio == null) {
    return {
      records: [],
      errors: ["找不到必填欄：name / anniversary / portfolio（可用中文欄名，見說明）"],
    };
  }

  const records: ReviewRecord[] = [];
  const errors: string[] = [];
  lines.slice(1).forEach((line, offset) => {
    const cells = splitCsvLine(line);
    const name = (cells[cols.name!] ?? "").replace(/^"|"$/g, "").trim();
    const anniversaryRaw = cells[cols.anniversary!] ?? "";
    const portfolioRaw = cells[cols.portfolio!] ?? "";
    const startRaw = cols.start_date != null ? (cells[cols.start_date] ?? "") : "";
    const anniversary = parseFlexibleDate(anniversaryRaw);
    const startDate = parseFlexibleDate(startRaw) ?? anniversary;
    const portfolioId = parsePortfolioId(portfolioRaw);
    if (!name || !anniversary || !portfolioId || !startDate) {
      errors.push(`第 ${offset + 2} 行未能匯入（姓名／日期／組合）`);
      return;
    }
    records.push({
      id: makeId(),
      name,
      anniversary,
      portfolioId,
      startDate,
    });
  });

  return { records, errors };
}

export function serializeReviewCsv(records: ReviewRecord[]): string {
  const header = REVIEW_CSV_COLUMNS.join(",");
  const rows = records.map((record) =>
    [
      csvCell(record.name),
      record.anniversary,
      PORTFOLIO_NAME_BY_ID[record.portfolioId],
      record.startDate,
    ].join(","),
  );
  return [header, ...rows].join("\n") + "\n";
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function parseReviewRecords(raw: unknown): ReviewRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: ReviewRecord[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item == null) continue;
    const row = item as Partial<ReviewRecord>;
    const anniversary = typeof row.anniversary === "string" ? parseFlexibleDate(row.anniversary) : null;
    const startDate = typeof row.startDate === "string" ? parseFlexibleDate(row.startDate) : anniversary;
    const portfolioId = typeof row.portfolioId === "string" ? parsePortfolioId(row.portfolioId) : null;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!name || !anniversary || !portfolioId || !startDate) continue;
    out.push({
      id: typeof row.id === "string" && row.id ? row.id : makeId(),
      name,
      anniversary,
      portfolioId,
      startDate,
    });
  }
  return out;
}

function makeId(): string {
  return `rev_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function readKey(key: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function writeKey(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / quota: review list just won't persist.
  }
}

export function loadReviewRecords(): ReviewRecord[] {
  return parseReviewRecords(readKey(REVIEW_STORAGE_KEY));
}

export function saveReviewRecords(records: ReviewRecord[]): void {
  writeKey(REVIEW_STORAGE_KEY, records);
}

export function upsertReviewRecord(records: ReviewRecord[], next: ReviewRecord): ReviewRecord[] {
  const index = records.findIndex((item) => item.id === next.id);
  if (index === -1) return [...records, next];
  const copy = records.slice();
  copy[index] = next;
  return copy;
}

export function removeReviewRecord(records: ReviewRecord[], id: string): ReviewRecord[] {
  return records.filter((item) => item.id !== id);
}

export function newReviewRecord(): ReviewRecord {
  return {
    id: makeId(),
    name: "",
    anniversary: "",
    portfolioId: "balanced",
    startDate: "",
  };
}

export type { ReviewSnapshot };
