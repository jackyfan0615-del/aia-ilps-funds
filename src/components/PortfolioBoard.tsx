"use client";

import { useState } from "react";
import Link from "next/link";
import type { PortfolioId, ResolvedPortfolio } from "@/lib/portfolios";
import { afterPolicyFee, POLICY_FEE_EARLY, POLICY_FEE_LATER } from "@/lib/policy-fees";
import { formatAbsPct, formatSignedPct, riskBadgeClass } from "@/lib/portfolio-stats";
import {
  EMPTY_ANSWERS,
  recommendPortfolio,
  type Drawdown,
  type Goal,
  type Horizon,
  type SuitabilityAnswers,
} from "@/lib/suitability";
import { typeLabel } from "@/lib/labels";

type Props = {
  portfolios: ResolvedPortfolio[];
};

const HORIZON_OPTIONS: { value: Horizon; label: string }[] = [
  { value: "under5", label: "少於 5 年" },
  { value: "mid", label: "約 5–7 年" },
  { value: "long", label: "7 年或以上" },
];

const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: "income", label: "帳戶要有現金股息" },
  { value: "growth", label: "累積淨值、少派息" },
];

const DRAWDOWN_OPTIONS: { value: Drawdown; label: string }[] = [
  { value: "cannot", label: "不能接受大跌" },
  { value: "moderate", label: "可接受中度波動" },
  { value: "can", label: "能接受 2022 那種大回撤" },
];

export function PortfolioBoard({ portfolios }: Props) {
  const [answers, setAnswers] = useState<SuitabilityAnswers>(EMPTY_ANSWERS);
  const [openIds, setOpenIds] = useState<Set<PortfolioId>>(() => new Set());
  const pick = recommendPortfolio(answers);
  const quizDone = pick != null;

  function setHorizon(horizon: Horizon) {
    setAnswers((current) => ({ ...current, horizon }));
  }
  function setGoal(goal: Goal) {
    setAnswers((current) => ({ ...current, goal }));
  }
  function setDrawdown(drawdown: Drawdown) {
    setAnswers((current) => ({ ...current, drawdown }));
  }

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

  return (
    <div className="portfolio-board">
      <section className="suitability" aria-labelledby="suitability-title">
        <h2 id="suitability-title" className="suitability-title">
          會面三題
        </h2>
        <p className="suitability-lead">先問這三題，再出一套主倉。不要先翻 145 隻基金。</p>
        <QuizRow
          legend="1. 投資年期？"
          name="horizon"
          value={answers.horizon}
          options={HORIZON_OPTIONS}
          onChange={setHorizon}
        />
        <QuizRow
          legend="2. 要現金息，還是淨值增長？"
          name="goal"
          value={answers.goal}
          options={GOAL_OPTIONS}
          onChange={setGoal}
        />
        <QuizRow
          legend="3. 2022 那種大回撤拿不拿得住？"
          name="drawdown"
          value={answers.drawdown}
          options={DRAWDOWN_OPTIONS}
          onChange={setDrawdown}
        />
        {pick ? (
          <div className="suitability-result">
            <p className="suitability-pick">
              主推 <strong>{portfolios.find((item) => item.id === pick.id)?.name ?? pick.id}</strong>
            </p>
            <p>{pick.reason}</p>
            {pick.caution ? <p className="suitability-caution">{pick.caution}</p> : null}
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setAnswers(EMPTY_ANSWERS);
                setOpenIds(new Set());
              }}
            >
              重設三題
            </button>
          </div>
        ) : (
          <p className="suitability-hint">答完三題會高亮一套，其餘收摺。</p>
        )}
      </section>

      <p className="result-count">
        四套內部參考配置：先定目標（派息或增值），再沿風險階梯由防守（現金／短債）→ 核心（平衡／多元）→
        衛星（股票／主題）配 5 隻基金，權重合計 100%。一個客人只推一套主倉。
      </p>
      <p className="portfolio-disclaimer">
        參考預期回報按各基金 AIA 過往賣出價加權；派息組合另計現金股息率。下方另列扣保單手續費約{" "}
        {(POLICY_FEE_EARLY * 100).toFixed(2)}%（首 5 年）及 {(POLICY_FEE_LATER * 100).toFixed(2)}%（第 6
        年起）後的數字，實際以保單為準。風險按年化波動及最大回撤。過往表現不代表將來表現，派息不保證。
      </p>

      {(quizDone
        ? [...portfolios].sort((a, b) => Number(b.id === pick.id) - Number(a.id === pick.id))
        : portfolios
      ).map((portfolio) => {
        const featured = quizDone && pick.id === portfolio.id;
        const open = isOpen(portfolio.id);
        return (
          <article
            key={portfolio.id}
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
            {!open ? <p className="portfolio-fit">{portfolio.summary}</p> : null}

            {quizDone && pick.id !== portfolio.id ? (
              <button
                type="button"
                className="text-btn"
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
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="quiz-row">
      <legend>{legend}</legend>
      <div className="quiz-options" role="radiogroup" aria-label={legend}>
        {options.map((option) => (
          <label key={option.value} className={value === option.value ? "is-on" : undefined}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
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
  const gross = portfolio.stats.expectedPct;
  const earlyNet = afterPolicyFee(gross, POLICY_FEE_EARLY);
  const laterNet = afterPolicyFee(gross, POLICY_FEE_LATER);
  const oneYear =
    portfolio.style === "派息" ? portfolio.stats.oneYearTotalPct : portfolio.stats.oneYearPct;

  return (
    <>
      {featured ? <MeetingCard portfolio={portfolio} /> : null}

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
      {portfolio.id === "steady" ? (
        <p className="fee-note">首 5 年現金／短債幾乎被手續費吃掉，新單較宜改用均衡核心。</p>
      ) : null}

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
        <div>
          <p className="price-label">年化波動</p>
          <p className="metric-value">{formatAbsPct(portfolio.stats.volPct)}</p>
          <p className="metric-sub">風險水平</p>
        </div>
        <div>
          <p className="price-label">最大回撤</p>
          <p className="metric-value is-down">{formatSignedPct(portfolio.stats.maxDrawdownPct)}</p>
          <p className="metric-sub">組合高峰至低位</p>
        </div>
      </div>

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
                <span className="holding-weight">{holding.weight}%</span>
                <span className="holding-main">
                  <span className="holding-code">{holding.code}</span>
                  <span className="holding-name">{holding.fund.name}</span>
                  <span className="holding-role">
                    {holding.role}
                    {` · ${typeLabel(holding.fund.type)} · ${holding.fund.risk}風險 · 近1年 ${formatSignedPct(holding.oneYearPct)}`}
                    {holding.dividendYieldPct != null
                      ? ` · 股息率 ${formatAbsPct(holding.dividendYieldPct)}`
                      : ""}
                  </span>
                </span>
              </Link>
            ) : (
              <div className="holding-btn is-disabled">
                <span className="holding-weight">{holding.weight}%</span>
                <span className="holding-main">
                  <span className="holding-code">{holding.code}</span>
                  <span className="holding-name">此代號目前不在目錄</span>
                  <span className="holding-role">{holding.role} · 已下架或暫停</span>
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>

      {!featured ? <MeetingCard portfolio={portfolio} /> : null}
    </>
  );
}

function MeetingCard({ portfolio }: { portfolio: ResolvedPortfolio }) {
  const gross = portfolio.stats.expectedPct;
  const earlyNet = afterPolicyFee(gross, POLICY_FEE_EARLY);
  const laterNet = afterPolicyFee(gross, POLICY_FEE_LATER);
  const mix = portfolio.holdings.map((holding) => `${holding.code} ${holding.weight}%`).join(" · ");

  return (
    <div className="meeting-card">
      <p className="meeting-kicker">會面摘要 · 可截圖</p>
      <h3 className="meeting-title">{portfolio.name}</h3>
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
        首 5 年 {formatSignedPct(earlyNet)} · 第 6 年起 {formatSignedPct(laterNet)}
        <span className="meeting-gross">（未扣保單費 {formatSignedPct(gross)}）</span>
      </p>
      <p>
        <strong>風險　</strong>
        {portfolio.meetingRisk}
      </p>
      <p className="meeting-foot">內部銷售參考，並非投資建議。過往表現不代表將來表現。</p>
    </div>
  );
}
