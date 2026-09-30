/**
 * Before/after portfolio max drawdown using live AIA FundChart data.
 *
 * Usage: npx tsx scripts/compare-drawdowns.ts
 *
 * Does not change allocations. Prints a markdown table for the PR.
 */
import { fetchAiaFundChart } from "../src/lib/aia";
import { computePortfolioStats, drawdownDisclosure, drawdownPeriodLabel, formatSignedPct } from "../src/lib/portfolio-stats";
import { legacyMaxDrawdownPct } from "../src/lib/portfolio-stats-legacy";
import { PORTFOLIO_TEMPLATES, mapWithLimit } from "../src/lib/portfolios";
import { allProxyCodes, resolveRiskSeries } from "../src/lib/price-proxies";
import type { ChartPoint } from "../src/lib/types";

async function main(): Promise<void> {
  const sleeveCodes = [
    ...new Set(PORTFOLIO_TEMPLATES.flatMap((template) => template.sleeves.map((sleeve) => sleeve.code))),
  ];
  const extra = allProxyCodes(sleeveCodes).filter((code) => !sleeveCodes.includes(code));
  const codes = [...sleeveCodes, ...extra];
  const charts = new Map<string, ChartPoint[]>();

  const results = await mapWithLimit(codes, 4, (code) => fetchAiaFundChart(code));
  results.forEach((result, index) => {
    charts.set(codes[index], result.ok ? result.value : []);
  });

  console.log("| 組合 | 舊最大回撤 | 新最大回撤 | 期間 | 代理／註明 |");
  console.log("|---|---|---|---|---|");

  for (const template of PORTFOLIO_TEMPLATES) {
    const own = template.sleeves.map((sleeve) => ({
      code: sleeve.code,
      weight: sleeve.weight,
      points: charts.get(sleeve.code) ?? [],
    }));
    const withRisk = own.map((holding) => {
      const risk = resolveRiskSeries(holding.code, holding.points, charts);
      return {
        ...holding,
        riskPoints: risk.points,
        drawdownProxy: risk.proxy,
        omittedFromDrawdown: risk.omitted,
      };
    });
    const after = computePortfolioStats(withRisk);
    const before = legacyMaxDrawdownPct(own);
    console.log(
      `| ${template.name} | ${formatSignedPct(before)} | ${formatSignedPct(after.maxDrawdownPct)} | ${drawdownPeriodLabel(after)} | ${drawdownDisclosure(after) ?? "無代理"} |`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
