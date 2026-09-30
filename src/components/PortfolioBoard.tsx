"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PortfolioId, ResolvedHolding, ResolvedPortfolio } from "@/lib/portfolios";
import { DIVIDEND_SOURCE_METHOD_ZH, FROM_CAPITAL_LABEL } from "@/lib/dividend-source";
import { afterPolicyFee, POLICY_FEE_EARLY, POLICY_FEE_LATER } from "@/lib/policy-fees";
import {
  drawdownDisclosure,
  drawdownPeriodLabel,
  drawdownPeriodRange,
  formatAbsPct,
  formatSignedPct,
  riskBadgeClass,
} from "@/lib/portfolio-stats";
import {
  DRAWDOWN_OPTIONS,
  EMPTY_ANSWERS,
  GOAL_OPTIONS,
  HORIZON_OPTIONS,
  WITHDRAWAL_OPTIONS,
  recommendPortfolio,
  type SuitabilityAnswers,
} from "@/lib/suitability";
import {
  loadOpenIds,
  loadQuizAnswers,
  saveOpenIds,
  saveQuizAnswers,
} from "@/lib/quiz-storage";
import { ClientSummaryButton } from "./ClientSummaryButton";
import { ShareLinkBuilder } from "./ShareLinkBuilder";
import { GrowthSimulator } from "./GrowthSimulator";
import { typeLabel } from "@/lib/labels";

type Props = {
  portfolios: ResolvedPortfolio[];
  fundCount: number;
};

export function PortfolioBoard({ portfolios, fundCount }: Props) {
  const [answers, setAnswers] = useState<SuitabilityAnswers>(EMPTY_ANSWERS);
  const [openIds, setOpenIds] = useState<Set<PortfolioId>>(() => new Set());
  const [restored, setRestored] = useState(false);
  const pick = recommendPortfolio(answers);
  const quizDone = pick != null;
  const featuredPortfolio = pick ? (portfolios.find((item) => item.id === pick.id) ?? null) : null;

  // Keep the quiz answers (and featured mix) across tab switches and fund
  // detail page visits. Restored in an effect after mount so the SSR HTML and
  // the first client render match (no hydration drift).
  /* eslint-disable react-hooks/set-state-in-effect -- intentional post-mount restore from localStorage */
  useEffect(() => {
    setAnswers(loadQuizAnswers());
    setOpenIds(loadOpenIds(portfolios.map((item) => item.id)));
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (restored) saveQuizAnswers(answers);
  }, [answers, restored]);

  useEffect(() => {
    if (restored) saveOpenIds(openIds);
  }, [openIds, restored]);

  function isOpen(id: PortfolioId) {
    if (!quizDone) return true;
    if (pick.id === id) return true;
    return openIds.has(id);
  }

  function toggle(id: PortfolioId) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const ordered = quizDone
    ? [...portfolios].sort((a, b) => Number(b.id === pick.id) - Number(a.id === pick.id))
    : portfolios;

  return (
    <div className="portfolio-board">
      <section className="suitability" aria-labelledby="suitability-title">
        <h2 id="suitability-title" className="suitability-title">
          會面四題
        </h2>
        <p className="suitability-lead">先問這四題，再出一套主倉。不要先翻 {fundCount} 隻基金。</p>
        <QuizRow
          legend="1. 投資年期？"
          value={answers.horizon}
          options={HORIZON_OPTIONS}
          onChange={(horizon) => setAnswers((current) => ({ ...current, horizon }))}
        />
        <QuizRow
          legend="2. 要現金息，還是淨值增長？"
          value={answers.goal}
          options={GOAL_OPTIONS}
          onChange={(goal) => setAnswers((current) => ({ ...current, goal }))}
        />
        <QuizRow
          legend="3. 2022 那種大回撤拿不拿得住？"
          value={answers.drawdown}
          options={DRAWDOWN_OPTIONS}
          onChange={(drawdown) => setAnswers((current) => ({ ...current, drawdown }))}
        />
        <QuizRow
          legend="4. 幾時要用錢？"
          value={answers.withdrawal}
          options={WITHDRAWAL_OPTIONS}
          onChange={(withdrawal) => setAnswers((current) => ({ ...current, withdrawal }))}
        />
        {pick && featuredPortfolio ? (
          <div className="suitability-result" data-pick={pick.id}>
            <p className="suitability-pick">
              主推 <strong>{featuredPortfolio.name}</strong>
            </p>
            <p>{pick.reason}</p>
            {pick.caution ? <p className="suitability-caution">{pick.caution}</p> : null}
            <ClientSummaryButton answers={answers} pick={pick} portfolio={featuredPortfolio} />
            <ShareLinkBuilder
              portfolios={portfolios}
              initialHoldings={featuredPortfolio.holdings.map((holding) => ({
                code: holding.code,
                weight: holding.weight,
              }))}
              compact
            />
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setAnswers(EMPTY_ANSWERS);
                setOpenIds(new Set());
              }}
            >
              重設四題
            </button>
          </div>
        ) : (
          <p className="suitability-hint">答完四題會高亮一套，其餘收摺。</p>
        )}
      </section>

      <p className="result-count">
        四套內部參考配置：先定目標（派息或增值），再沿風險階梯由防守（現金／短債）→ 核心（平衡／多元）→
        衛星（股票／主題）配 5 隻基金，權重合計 100%。一個客人只推一套主倉。
      </p>
      <p className="portfolio-disclaimer">
        參考預期回報按各基金 AIA 過往賣出價加權；派息組合另計現金股息率。下方另列扣保單手續費約{" "}
        {(POLICY_FEE_EARLY * 100).toFixed(2)}%（首 5 年）及 {(POLICY_FEE_LATER * 100).toFixed(2)}%（第 6
        年起）後的數字，實際以保單為準，收費可按條款調整。風險按年化波動及最大回撤。過往表現不代表將來表現，派息不保證。
      </p>

      {ordered.map((portfolio) => {
        const featured = quizDone && pick.id === portfolio.id;
        const open = isOpen(portfolio.id);
        const collapsed = quizDone && !open;
        return (
          <article
            key={portfolio.id}
            id={`mix-${portfolio.id}`}
            data-mix={portfolio.id}
            data-featured={featured ? "true" : "false"}
            data-open={open ? "true" : "false"}
            className={`portfolio-card${featured ? " is-featured" : ""}${open ? "" : " is-collapsed"}`}
          >
            <div className="portfolio-head">
              <h2>{portfolio.name}</h2>
              <div className="fund-codes">
                {featured ? <span className="pick-badge">主推</span> : null}
                <span className={`fund-type ${portfolio.style === "派息" ? "is-div" : "is-growth"}`}>
                  {portfolio.style}
                </span>
                <span className={`fund-risk ${riskBadgeClass(portfolio.stats.riskLabel)}`}>
                  {portfolio.stats.riskLabel}風險
                </span>
              </div>
            </div>
            {collapsed ? <p className="portfolio-fit">{portfolio.summary}</p> : null}

            {quizDone && pick.id !== portfolio.id ? (
              <button
                type="button"
                className="expand-btn"
                aria-expanded={open}
                onClick={() => toggle(portfolio.id)}
              >
                {open ? "收起詳情" : "展開詳情"}
              </button>
            ) : null}

            {open ? <PortfolioBody portfolio={portfolio} featured={featured} /> : null}
          </article>
        );
      })}
    </div>
  );
}

function QuizRow<T extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="quiz-row">
      <legend>{legend}</legend>
      <div className="quiz-options" role="radiogroup" aria-label={legend}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={selected ? "is-on" : undefined}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function PortfolioBody({
  portfolio,
  featured,
}: {
  portfolio: ResolvedPortfolio;
  featured: boolean;
}) {
  const provisional = portfolio.dataStatus === "provisional";
  const gross = portfolio.stats.expectedPct;
  const earlyNet = afterPolicyFee(gross, POLICY_FEE_EARLY);
  const laterNet = afterPolicyFee(gross, POLICY_FEE_LATER);
  const oneYear =
    portfolio.style === "派息" ? portfolio.stats.oneYearTotalPct : portfolio.stats.oneYearPct;
  const drawdownNote = drawdownDisclosure(portfolio.stats);
  const source = portfolio.stats.dividendSource;

  return (
    <>
      {featured ? <MeetingCard portfolio={portfolio} /> : null}

      {provisional ? (
        <div className="fee-strip is-pending" role="status">
          <p className="data-pending-title">數據更新中</p>
          <p className="data-pending-note">
            {portfolio.failedCodes.length > 0
              ? `以下基金數據暫未能更新：${portfolio.failedCodes.join("、")}。`
              : "部分基金數據暫未能更新。"}
            扣費後參考回報及滾存模擬會在數據齊備後顯示。
          </p>
        </div>
      ) : (
        <div className="fee-strip" aria-label="扣保單費後參考回報">
          <div>
            <p className="price-label">未扣保單費</p>
            <p className={`metric-value ${(gross ?? 0) >= 0 ? "is-up" : "is-down"}`}>
              {formatSignedPct(gross)}
            </p>
            <p className="metric-sub">
              {portfolio.style === "派息" && portfolio.stats.dividendYieldPct != null
                ? "近1年價格 + 股息率"
                : `按過去${portfolio.stats.expectedHorizon}`}
            </p>
          </div>
          <div>
            <p className="price-label">首 5 年扣費後</p>
            <p className={`metric-value ${(earlyNet ?? 0) >= 0 ? "is-up" : "is-down"}`}>
              {formatSignedPct(earlyNet)}
            </p>
            <p className="metric-sub">約 −{(POLICY_FEE_EARLY * 100).toFixed(2)}% 手續費</p>
          </div>
          <div>
            <p className="price-label">第 6 年起扣費後</p>
            <p className={`metric-value ${(laterNet ?? 0) >= 0 ? "is-up" : "is-down"}`}>
              {formatSignedPct(laterNet)}
            </p>
            <p className="metric-sub">約 −{(POLICY_FEE_LATER * 100).toFixed(2)}% 手續費</p>
          </div>
        </div>
      )}
      {portfolio.id === "steady" ? (
        <p className="fee-note">
          首 5 年現金／短債（W04＋W06 合共 30%）扣約 2.38% 手續費後淨回報偏薄，不是保本。
        </p>
      ) : null}

      <GrowthSimulator
        gross={gross}
        basisLabel={`過去${portfolio.stats.expectedHorizon}`}
        provisional={provisional}
        maxDrawdownPct={portfolio.stats.maxDrawdownPct}
      />

      <div className="portfolio-metrics">
        {portfolio.style === "派息" ? (
          <div>
            <p className="price-label">參考股息率</p>
            <p className="metric-value is-up">{formatAbsPct(portfolio.stats.dividendYieldPct)}</p>
            <p className="metric-sub">
              {portfolio.stats.dividendYieldMethod === "annualized"
                ? "部分基金按近月年化"
                : "AIA 現金派息／最新賣出價"}
            </p>
          </div>
        ) : null}
        <div>
          <p className="price-label">{portfolio.style === "派息" ? "近1年含息" : "近1年"}</p>
          <p className={`metric-value ${(oneYear ?? 0) >= 0 ? "is-up" : "is-down"}`}>
            {formatSignedPct(oneYear)}
          </p>
          <p className="metric-sub">
            {portfolio.style === "派息"
              ? `價格 ${formatSignedPct(portfolio.stats.oneYearPct)}`
              : portfolio.stats.threeYearCagrPct != null
                ? `3年 ${formatSignedPct(portfolio.stats.threeYearCagrPct)}`
                : "過往總回報"}
          </p>
        </div>
        {portfolio.style === "派息" && source ? (
          <div>
            <p className="price-label">派息來源</p>
            <p className={`metric-value ${source.fromCapital ? "is-down" : "is-up"}`}>
              {formatSignedPct(source.oneYearCapitalPct)}
            </p>
            <p className="metric-sub">含息 − 股息率</p>
            {source.fromCapital ? <p className="source-flag">{FROM_CAPITAL_LABEL}</p> : null}
          </div>
        ) : null}
        <div>
          <p className="price-label">年化波動</p>
          <p className="metric-value">{formatAbsPct(portfolio.stats.volPct)}</p>
          <p className="metric-sub">風險水平</p>
        </div>
        <div>
          <p className="price-label">最大回撤</p>
          <p className={`metric-value is-down`}>{formatSignedPct(portfolio.stats.maxDrawdownPct)}</p>
          <p className="metric-sub">{drawdownPeriodLabel(portfolio.stats)}</p>
        </div>
      </div>
      {portfolio.style === "派息" ? <p className="drawdown-note">{DIVIDEND_SOURCE_METHOD_ZH}</p> : null}
      {drawdownNote ? <p className="drawdown-note">{drawdownNote}</p> : null}

      <p className="portfolio-principle">{portfolio.principle}</p>
      <p className="portfolio-fit">{portfolio.suitedFor}</p>
      <p className="sleeve-why">
        <strong>為何選這些基金　</strong>
        {portfolio.whySleeves}
      </p>
      <p className="sleeve-alt">
        <strong>常見替代　</strong>
        {portfolio.alternatives}
      </p>

      <div className="allocation-bar" aria-hidden="true">
        {portfolio.holdings.map((holding) => (
          <span
            key={holding.code}
            className={`alloc-seg ${holding.fund?.type === "dividend" ? "is-div" : "is-growth"}`}
            style={{ width: `${holding.weight}%` }}
          />
        ))}
      </div>
      <ul className="holding-list">
        {portfolio.holdings.map((holding) => (
          <li key={holding.code}>
            {holding.fund ? (
              <Link href={`/funds/${holding.code}`} className="holding-btn">
                <HoldingCopy holding={holding} showSource={portfolio.style === "派息"} />
              </Link>
            ) : (
              <div className="holding-btn is-disabled">
                <HoldingCopy holding={holding} showSource={portfolio.style === "派息"} />
              </div>
            )}
          </li>
        ))}
      </ul>

      {!featured ? <MeetingCard portfolio={portfolio} /> : null}
    </>
  );
}

function HoldingCopy({
  holding,
  showSource,
}: {
  holding: ResolvedHolding;
  showSource: boolean;
}) {
  return (
    <>
      <span className="holding-weight">{holding.weight}%</span>
      <span className="holding-main">
        <span className="holding-code">{holding.code}</span>
        <span className="holding-name">{holding.fund?.name ?? "此代號目前不在目錄"}</span>
        <span className="holding-role">
          {holding.fund
            ? `${holding.role} · ${typeLabel(holding.fund.type)} · ${holding.fund.risk}風險 · 近1年 ${
                holding.oneYearPct == null ? "數據待更新" : formatSignedPct(holding.oneYearPct)
              }`
            : `${holding.role} · 已下架或暫停`}
          {holding.dividendYieldPct != null ? ` · 股息率 ${formatAbsPct(holding.dividendYieldPct)}` : ""}
          {showSource && holding.dividendSource
            ? ` · 派息來源 ${formatSignedPct(holding.dividendSource.oneYearCapitalPct)}`
            : ""}
        </span>
        {showSource && holding.dividendSource?.fromCapital ? (
          <span className="source-flag">{FROM_CAPITAL_LABEL}</span>
        ) : null}
      </span>
    </>
  );
}

function MeetingCard({ portfolio }: { portfolio: ResolvedPortfolio }) {
  const provisional = portfolio.dataStatus === "provisional";
  const gross = portfolio.stats.expectedPct;
  const earlyNet = afterPolicyFee(gross, POLICY_FEE_EARLY);
  const laterNet = afterPolicyFee(gross, POLICY_FEE_LATER);
  const mix = portfolio.holdings.map((holding) => `${holding.code} ${holding.weight}%`).join(" · ");
  const source = portfolio.stats.dividendSource;

  return (
    <div className="meeting-card" id={`meeting-${portfolio.id}`}>
      <p className="meeting-kicker">會面摘要 · 可截圖</p>
      <p className="meeting-title">{portfolio.name}</p>
      <p>
        <strong>適合　</strong>
        {portfolio.suitedFor}
      </p>
      <p>
        <strong>配置　</strong>
        {mix}
      </p>
      <p>
        <strong>扣費後參考　</strong>
        {provisional ? (
          "數據更新中"
        ) : (
          <>
            首 5 年 {formatSignedPct(earlyNet)} · 第 6 年起 {formatSignedPct(laterNet)}
            <span className="meeting-gross">（未扣保單費 {formatSignedPct(gross)}）</span>
          </>
        )}
      </p>
      <p>
        <strong>風險　</strong>
        {portfolio.meetingRisk}
        {portfolio.stats.maxDrawdownPct != null && drawdownPeriodRange(portfolio.stats)
          ? ` 過去最大回撤 ${formatSignedPct(portfolio.stats.maxDrawdownPct)}（${drawdownPeriodRange(portfolio.stats)}）。`
          : ""}
        {portfolio.stats.drawdownProxies.length > 0 || portfolio.stats.drawdownOmitted.length > 0
          ? " 部分基金早期走勢經同類基金代理或因數據不足未納入，詳見組合說明。"
          : ""}
      </p>
      {source ? (
        <p>
          <strong>派息來源　</strong>
          近1年含息 {formatSignedPct(source.oneYearTotalPct)} − 股息率 {formatAbsPct(source.yieldPct)} ={" "}
          {formatSignedPct(source.oneYearCapitalPct)}
          {source.fromCapital ? `。${FROM_CAPITAL_LABEL}` : "。"}
        </p>
      ) : null}
      <p className="meeting-foot">內部銷售參考，並非投資建議。過往表現不代表將來表現。</p>
    </div>
  );
}
