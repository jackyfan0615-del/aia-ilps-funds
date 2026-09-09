import { readFileSync } from "fs";
import path from "path";

export type FundNote = {
  comment?: string;
  benchmark?: string;
  market?: string;
  tradingView?: string;
  dividendRatePct?: number;
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
      note.dividendRatePct != null,
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
