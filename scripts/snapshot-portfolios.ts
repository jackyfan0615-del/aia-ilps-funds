import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { fetchAiaFunds } from "../src/lib/aia";
import { getFallbackDataset } from "../src/lib/funds";
import { resolvePortfoliosWithStats } from "../src/lib/portfolios";
import {
  applyQuarterSnapshot,
  getQuarterReview,
  type PortfolioQuarterFile,
  type PortfolioQuarterSnapshot,
} from "../src/lib/quarter";

const root = process.cwd();
const snapshotPath = path.join(root, "data", "portfolio-quarter.json");

function readPrevious(): PortfolioQuarterFile | null {
  if (!existsSync(snapshotPath)) return null;
  return JSON.parse(readFileSync(snapshotPath, "utf-8")) as PortfolioQuarterFile;
}

async function loadFunds() {
  try {
    return (await fetchAiaFunds(true)).funds;
  } catch (error) {
    console.error("[snapshot-portfolios] AIA live fetch failed, using fallback JSON", error);
    return getFallbackDataset().funds;
  }
}

async function main() {
  const funds = await loadFunds();
  const portfolios = await resolvePortfoliosWithStats(funds);
  const previous = readPrevious();
  const review = getQuarterReview();
  const snapshot: PortfolioQuarterSnapshot = {
    effectiveFrom: review.lastStart,
    nextReview: review.nextStart,
    reviewedAt: new Date().toISOString(),
    mix: portfolios.map((portfolio) => ({
      id: portfolio.id,
      name: portfolio.name,
      style: portfolio.style,
      sleeves: portfolio.holdings.map((holding) => ({
        code: holding.code,
        weight: holding.weight,
        role: holding.role,
      })),
      stats: {
        expectedPct: portfolio.stats.expectedPct,
        expectedHorizon: portfolio.stats.expectedHorizon,
        oneYearPct: portfolio.stats.oneYearPct,
        oneYearTotalPct: portfolio.stats.oneYearTotalPct,
        dividendYieldPct: portfolio.stats.dividendYieldPct,
        volPct: portfolio.stats.volPct,
        maxDrawdownPct: portfolio.stats.maxDrawdownPct,
        riskLabel: portfolio.stats.riskLabel,
      },
    })),
  };
  const next = applyQuarterSnapshot(previous, snapshot);
  writeFileSync(snapshotPath, `${JSON.stringify(next, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        effectiveFrom: snapshot.effectiveFrom,
        nextReview: snapshot.nextReview,
        reviewedAt: snapshot.reviewedAt,
        history: next.history.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
