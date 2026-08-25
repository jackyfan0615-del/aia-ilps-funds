import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fetchAiaFunds } from "../src/lib/aia";
import {
  diffCatalog,
  hasCatalogChanges,
  recordCatalogEvent,
  type CatalogChangesFile,
} from "../src/lib/catalog";
import type { FundsDataset } from "../src/lib/types";

const root = process.cwd();
const fundsPath = path.join(root, "data", "funds.json");
const changesPath = path.join(root, "data", "catalog-changes.json");

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf-8")) as T;
}

async function main() {
  const previous = readJson<FundsDataset>(fundsPath);
  const live = await fetchAiaFunds(true);
  const diff = diffCatalog(previous.funds, live.funds);
  const catalogChanged = hasCatalogChanges(diff);

  if (catalogChanged) {
    const previousChanges = readJson<CatalogChangesFile>(changesPath);
    const nextChanges = recordCatalogEvent(previousChanges, diff, live.scrapedAt);
    writeFileSync(fundsPath, `${JSON.stringify(live, null, 2)}\n`);
    writeFileSync(changesPath, `${JSON.stringify(nextChanges, null, 2)}\n`);
  }

  console.log(
    JSON.stringify(
      {
        catalogChanged,
        counts: live.counts,
        added: diff.added.map((item) => item.code),
        removed: diff.removed.map((item) => item.code),
        renamed: diff.renamed.map((item) => item.code),
      },
      null,
      2,
    ),
  );

  if (process.env.GITHUB_OUTPUT) {
    writeFileSync(
      process.env.GITHUB_OUTPUT,
      `catalog_changed=${catalogChanged}\n`,
      { flag: "a" },
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
