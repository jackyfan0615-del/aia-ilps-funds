import type { PortfolioId } from "./portfolios";

export type Horizon = "under5" | "mid" | "long";
export type Goal = "income" | "growth";
export type Drawdown = "cannot" | "moderate" | "can";

export type SuitabilityAnswers = {
  horizon: Horizon | null;
  goal: Goal | null;
  drawdown: Drawdown | null;
};

export type SuitabilityResult = {
  id: PortfolioId;
  reason: string;
  caution: string | null;
};

export const EMPTY_ANSWERS: SuitabilityAnswers = {
  horizon: null,
  goal: null,
  drawdown: null,
};

export function isQuizComplete(answers: SuitabilityAnswers): answers is {
  horizon: Horizon;
  goal: Goal;
  drawdown: Drawdown;
} {
  return answers.horizon != null && answers.goal != null && answers.drawdown != null;
}

export function recommendPortfolio(answers: SuitabilityAnswers): SuitabilityResult | null {
  if (!isQuizComplete(answers)) return null;

  const caution =
    answers.horizon === "under5"
      ? "年期短於 5 年通常不應推投連險：退保費用加上首 5 年約 2.4% 手續費會吃掉回報。以下配置僅供說明。"
      : null;

  if (answers.goal === "income") {
    return {
      id: "income",
      reason: "客人要帳戶現金股息，主推派息入息（Z 字）。J16 等累積收益基金不會派現金入保單。",
      caution,
    };
  }

  if (answers.drawdown === "cannot") {
    return {
      id: "steady",
      reason:
        "完全不能接受股票大波動，才用穩健增長。請講明首 5 年現金／短債幾乎被手續費吃掉，帳戶可能幾乎不升。",
      caution,
    };
  }

  if (answers.drawdown === "can" && answers.horizon === "long") {
    return {
      id: "growth",
      reason: "年期夠長、能接受 2022 那種回撤，主推進取增長。一套主倉即可，不要再疊主題基金。",
      caution,
    };
  }

  return {
    id: "balanced",
    reason: "新單首 5 年或只能接受中度波動，主推均衡核心：少放現金、股票核心夠交手續費，回撤比進取溫和。",
    caution,
  };
}
