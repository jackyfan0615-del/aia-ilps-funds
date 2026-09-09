import { readFileSync } from "fs";
import path from "path";

export type FundNote = {
  comment?: string;
  benchmark?: string;
  market?: string;
  tradingView?: string;
  dividendRatePct?: number;
  /** 基本面論點：這隻基金賺的是什麼經濟。 */
  thesis?: string;
  /** 週期位置：仍差 / 惡化減速 / 已確認反轉。左側只買前兩種。 */
  cycle?: string;
  /** 估值：對自身歷史、基準、同類是否有安全邊際。 */
  valuation?: string;
  /** 何時認錯：基本面條件或時間，不是「再跌就加」。 */
  invalidation?: string;
  /** 左側分注：第一次不滿倉，再弱才加。 */
  scaleIn?: string;
  updatedAt: string;
};

export type FundNotesFile = {
  updatedAt: string;
  notes: Record<string, FundNote>;
};

export function hasFundNote(note: FundNote | undefined): note is FundNote {
  if (!note) return false;
  return Boolean(
    note.comment?.trim() ||
      note.benchmark?.trim() ||
      note.market?.trim() ||
      note.tradingView?.trim() ||
      note.dividendRatePct != null ||
      note.thesis?.trim() ||
      note.cycle?.trim() ||
      note.valuation?.trim() ||
      note.invalidation?.trim() ||
      note.scaleIn?.trim(),
  );
}

export function getFundNotesFile(): FundNotesFile {
  const filePath = path.join(process.cwd(), "data", "fund-notes.json");
  return JSON.parse(readFileSync(filePath, "utf-8")) as FundNotesFile;
}

export function getFundNote(code: string): FundNote | undefined {
  const note = getFundNotesFile().notes[code.trim().toUpperCase()];
  return hasFundNote(note) ? note : undefined;
}

export function getResearchedCodes(): string[] {
  const { notes } = getFundNotesFile();
  return Object.keys(notes)
    .filter((code) => hasFundNote(notes[code]))
    .sort();
}
