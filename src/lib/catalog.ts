import type { Fund } from "./types";

export type CatalogChangeItem = {
  code: string;
  name: string;
  type: Fund["type"];
};

export type CatalogRename = {
  code: string;
  from: string;
  to: string;
};

export type CatalogDiff = {
  added: CatalogChangeItem[];
  removed: CatalogChangeItem[];
  renamed: CatalogRename[];
};

export type CatalogHistoryEvent = CatalogDiff & {
  at: string;
};

export type CatalogChangesFile = {
  checkedAt: string;
  history: CatalogHistoryEvent[];
};

function toItem(fund: Fund): CatalogChangeItem {
  return { code: fund.code, name: fund.name, type: fund.type };
}

export function hasCatalogChanges(diff: CatalogDiff): boolean {
  return diff.added.length > 0 || diff.removed.length > 0 || diff.renamed.length > 0;
}

export function diffCatalog(previous: Fund[], current: Fund[]): CatalogDiff {
  const prevMap = new Map(previous.map((fund) => [fund.code, fund]));
  const currMap = new Map(current.map((fund) => [fund.code, fund]));

  const added: CatalogChangeItem[] = [];
  const removed: CatalogChangeItem[] = [];
  const renamed: CatalogRename[] = [];

  for (const fund of current) {
    const prev = prevMap.get(fund.code);
    if (!prev) {
      added.push(toItem(fund));
    } else if (prev.name !== fund.name) {
      renamed.push({ code: fund.code, from: prev.name, to: fund.name });
    }
  }

  for (const fund of previous) {
    if (!currMap.has(fund.code)) {
      removed.push(toItem(fund));
    }
  }

  return { added, removed, renamed };
}

export function pickCatalogNotice(
  liveDiff: CatalogDiff,
  history: CatalogHistoryEvent[],
  checkedAt: string,
): CatalogHistoryEvent | null {
  if (hasCatalogChanges(liveDiff)) {
    return { at: checkedAt, ...liveDiff };
  }

  const latest = history[0];
  if (!latest || !hasCatalogChanges(latest)) return null;

  const ageMs = Date.now() - new Date(latest.at).getTime();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  return ageMs <= thirtyDays ? latest : null;
}

export function recordCatalogEvent(
  file: CatalogChangesFile,
  diff: CatalogDiff,
  at = new Date().toISOString(),
): CatalogChangesFile {
  const history = hasCatalogChanges(diff)
    ? [{ at, ...diff }, ...file.history].slice(0, 8)
    : file.history;

  return { checkedAt: at, history };
}
