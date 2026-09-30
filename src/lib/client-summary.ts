import { afterPolicyFee, POLICY_FEE_EARLY, POLICY_FEE_LATER } from "./policy-fees";
import { DIVIDEND_SOURCE_METHOD_ZH, FROM_CAPITAL_LABEL } from "./dividend-source";
import { formatHKD, projectStressPath } from "./growth-projection";
import { drawdownPeriodRange, formatAbsPct, formatSignedPct } from "./portfolio-stats";
import { formatQuizAnswersZh, type SuitabilityAnswers, type SuitabilityResult } from "./suitability";
import type { ResolvedPortfolio } from "./portfolios";

export const SUMMARY_DISCLAIMERS_ZH = [
  "內部銷售參考，並非投資建議。",
  "過往表現不代表將來表現。",
  "派息不保證，亦可從本金支付。",
];

export type ClientSummaryModel = {
  clientName: string;
  dateLabel: string;
  answers: { horizon: string; goal: string; drawdown: string; withdrawal: string };
  portfolioName: string;
  mix: string;
  reason: string;
  caution: string | null;
  afterFeeEarly: string;
  afterFeeLater: string;
  gross: string;
  maxDrawdown: string;
  drawdownPeriod: string | null;
  stressYear1: string | null;
  stressRecover: string | null;
  dividendNote: string | null;
  disclaimers: string[];
};

const DEFAULT_PRINCIPAL = 1_000_000;
const DEFAULT_STRESS_YEARS = 10;

export function buildClientSummary(input: {
  clientName: string;
  answers: SuitabilityAnswers;
  pick: SuitabilityResult;
  portfolio: ResolvedPortfolio;
  now?: Date;
}): ClientSummaryModel {
  const { clientName, answers, pick, portfolio } = input;
  const now = input.now ?? new Date();
  const dateLabel = now.toLocaleDateString("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const gross = portfolio.stats.expectedPct;
  const earlyNet = afterPolicyFee(gross, POLICY_FEE_EARLY);
  const laterNet = afterPolicyFee(gross, POLICY_FEE_LATER);
  const stress = projectStressPath(
    DEFAULT_PRINCIPAL,
    DEFAULT_STRESS_YEARS,
    portfolio.stats.maxDrawdownPct,
    earlyNet,
    laterNet,
  );
  const source = portfolio.stats.dividendSource;
  let dividendNote: string | null = null;
  if (portfolio.style === "派息" && source) {
    const bits = [
      `近1年含息 ${formatSignedPct(source.oneYearTotalPct)} − 股息率 ${formatAbsPct(source.yieldPct)} = 價格 ${formatSignedPct(source.oneYearCapitalPct)}`,
    ];
    if (source.fiveYearCapitalPct != null) {
      bits.push(`5年價格年化 ${formatSignedPct(source.fiveYearCapitalPct)}`);
    }
    if (source.fromCapital) bits.push(FROM_CAPITAL_LABEL);
    dividendNote = `${bits.join("。")}。${DIVIDEND_SOURCE_METHOD_ZH}`;
  }

  return {
    clientName: clientName.trim() || "（未填姓名）",
    dateLabel,
    answers: formatQuizAnswersZh(answers),
    portfolioName: portfolio.name,
    mix: portfolio.holdings.map((holding) => `${holding.code} ${holding.weight}%`).join(" · "),
    reason: pick.reason,
    caution: pick.caution,
    afterFeeEarly: formatSignedPct(earlyNet),
    afterFeeLater: formatSignedPct(laterNet),
    gross: formatSignedPct(gross),
    maxDrawdown: formatSignedPct(portfolio.stats.maxDrawdownPct),
    drawdownPeriod: drawdownPeriodRange(portfolio.stats),
    stressYear1: stress ? formatHKD(stress.year1Value) : null,
    stressRecover:
      stress == null
        ? null
        : stress.yearsToRecover == null
          ? "按此扣費後年化，50 年內未能回到本金"
          : `約 ${stress.yearsToRecover} 年回到本金`,
    dividendNote,
    disclaimers: SUMMARY_DISCLAIMERS_ZH,
  };
}

export function clientSummaryHtml(model: ClientSummaryModel): string {
  const row = (label: string, value: string) =>
    `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
  const answers = [
    row("1. 投資年期", model.answers.horizon),
    row("2. 現金息或淨值增長", model.answers.goal),
    row("3. 回撤承受", model.answers.drawdown),
    row("4. 幾時要用錢", model.answers.withdrawal),
  ].join("");

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(model.clientName)} · 會面摘要</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "PingFang TC", "Noto Sans TC", "Source Han Sans TC", sans-serif;
      color: #102033;
      font-size: 11.5pt;
      line-height: 1.45;
    }
    h1 { font-size: 16pt; margin: 0 0 4pt; }
    .kicker { font-size: 9pt; letter-spacing: 0.12em; color: #5b6b7c; margin: 0 0 8pt; }
    table { width: 100%; border-collapse: collapse; margin: 6pt 0 10pt; }
    th, td { border-bottom: 0.4pt solid #d5dde4; padding: 4pt 0; vertical-align: top; }
    th { width: 28%; text-align: left; color: #5b6b7c; font-weight: 650; font-size: 10pt; }
    .box { border: 0.6pt solid #d5dde4; padding: 8pt 10pt; margin: 8pt 0; }
    .caution { color: #c8102e; }
    .foot { font-size: 9pt; color: #5b6b7c; margin-top: 10pt; }
  </style>
</head>
<body>
  <p class="kicker">AIA 卓達智悅 2 · 內部會面摘要</p>
  <h1>${escapeHtml(model.clientName)}</h1>
  <p>日期：${escapeHtml(model.dateLabel)}</p>
  <table>${answers}</table>
  <div class="box">
    <p><strong>主推組合　</strong>${escapeHtml(model.portfolioName)}</p>
    <p><strong>配置　</strong>${escapeHtml(model.mix)}</p>
    <p>${escapeHtml(model.reason)}</p>
    ${model.caution ? `<p class="caution">${escapeHtml(model.caution)}</p>` : ""}
  </div>
  <table>
    ${row("扣費後參考", `首 5 年 ${model.afterFeeEarly} · 第 6 年起 ${model.afterFeeLater}（未扣費 ${model.gross}）`)}
    ${row("最大回撤", `${model.maxDrawdown}${model.drawdownPeriod ? `（${model.drawdownPeriod}）` : ""}`)}
    ${row("跌市情境", model.stressYear1 ? `第 1 年 ${model.stressYear1}（本金 HK$1,000,000）· ${model.stressRecover ?? ""}。此為情境，不是預測。` : "數據不足")}
    ${model.dividendNote ? row("派息來源", model.dividendNote) : ""}
  </table>
  <p class="foot">${model.disclaimers.map(escapeHtml).join("<br/>")}</p>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
