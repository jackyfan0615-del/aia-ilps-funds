import type { PortfolioId } from "./portfolios";

export type Horizon = "under5" | "mid" | "long";
export type Goal = "income" | "growth";
export type Drawdown = "cannot" | "moderate" | "can";
export type Withdrawal = "within5" | "fiveToTen" | "beyond10" | "noPlan";

export type SuitabilityAnswers = {
  horizon: Horizon | null;
  goal: Goal | null;
  drawdown: Drawdown | null;
  withdrawal: Withdrawal | null;
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
  withdrawal: null,
};

export const HORIZON_OPTIONS: { value: Horizon; label: string }[] = [
  { value: "under5", label: "少於 5 年" },
  { value: "mid", label: "約 5–7 年" },
  { value: "long", label: "7 年或以上" },
];

export const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: "income", label: "帳戶要有現金股息" },
  { value: "growth", label: "累積淨值、少派息" },
];

export const DRAWDOWN_OPTIONS: { value: Drawdown; label: string }[] = [
  { value: "cannot", label: "不能接受大跌" },
  { value: "moderate", label: "可接受中度波動" },
  { value: "can", label: "能接受 2022 那種大回撤" },
];

export const WITHDRAWAL_OPTIONS: { value: Withdrawal; label: string }[] = [
  { value: "within5", label: "5 年內要用" },
  { value: "fiveToTen", label: "約 5–10 年" },
  { value: "beyond10", label: "10 年後" },
  { value: "noPlan", label: "未有計劃" },
];

export const EARLY_WITHDRAWAL_WARNING =
  "首 5 年手續費約 2.4%，加上跌市時賣出會鎖死虧損。年期短或要提早用錢，通常不應推投連險；以下配置僅供說明。";

export function isQuizComplete(answers: SuitabilityAnswers): answers is {
  horizon: Horizon;
  goal: Goal;
  drawdown: Drawdown;
  withdrawal: Withdrawal;
} {
  return (
    answers.horizon != null &&
    answers.goal != null &&
    answers.drawdown != null &&
    answers.withdrawal != null
  );
}

function optionLabel<T extends string>(
  options: { value: T; label: string }[],
  value: T | null,
): string {
  if (value == null) return "—";
  return options.find((option) => option.value === value)?.label ?? value;
}

export function formatQuizAnswersZh(answers: SuitabilityAnswers): {
  horizon: string;
  goal: string;
  drawdown: string;
  withdrawal: string;
} {
  return {
    horizon: optionLabel(HORIZON_OPTIONS, answers.horizon),
    goal: optionLabel(GOAL_OPTIONS, answers.goal),
    drawdown: optionLabel(DRAWDOWN_OPTIONS, answers.drawdown),
    withdrawal: optionLabel(WITHDRAWAL_OPTIONS, answers.withdrawal),
  };
}

function earlyMoneyCaution(answers: SuitabilityAnswers): string | null {
  const parts: string[] = [];
  if (answers.horizon === "under5" || answers.withdrawal === "within5") {
    parts.push(EARLY_WITHDRAWAL_WARNING);
  } else if (answers.withdrawal === "fiveToTen") {
    parts.push(
      "5–10 年內要用錢：若第 1 年遇上類似 2022 的回撤，扣費後回本可能要數年，提早賣出會鎖死虧損。",
    );
  } else if (answers.withdrawal === "noPlan") {
    parts.push("未有用錢時間表，先當中期：跌市或首 5 年要贖回，手續費同鎖死虧損風險仍然在。");
  }
  return parts.length > 0 ? parts.join(" ") : null;
}

export function recommendPortfolio(answers: SuitabilityAnswers): SuitabilityResult | null {
  if (!isQuizComplete(answers)) return null;

  const caution = earlyMoneyCaution(answers);
  const earlyExit = answers.withdrawal === "within5" || answers.horizon === "under5";
  const midExit = answers.withdrawal === "fiveToTen" || answers.withdrawal === "noPlan";

  if (answers.goal === "income") {
    return {
      id: "income",
      reason: "客人要帳戶現金股息，主推派息入息（Z 字）。J16 等累積收益基金不會派現金入保單。",
      caution,
    };
  }

  if (earlyExit) {
    if (answers.drawdown === "can") {
      return {
        id: "balanced",
        reason:
          "5 年內可能要用錢，即使能接受回撤也不推進取：主推均衡核心，回撤較溫和，方便講首 5 年手續費。",
        caution,
      };
    }
    return {
      id: "steady",
      reason:
        "5 年內要用錢或完全不能接受大跌，主推穩健增長。請講明首 5 年手續費同跌市賣出風險，不是保本。",
      caution,
    };
  }

  if (answers.drawdown === "cannot") {
    return {
      id: "steady",
      reason:
        "完全不能接受股票大波動，才用穩健增長。請講明首 5 年現金／短債扣費後淨回報偏薄，帳戶可能幾乎不升。",
      caution,
    };
  }

  if (midExit) {
    return {
      id: "balanced",
      reason:
        "用錢年期約 5–10 年或未定，主推均衡核心：少放現金、回撤比進取溫和，避免在跌市中途贖回進取倉。",
      caution,
    };
  }

  if (answers.drawdown === "can" && answers.horizon === "long") {
    return {
      id: "growth",
      reason: "用錢遠過 10 年、年期夠長、能接受 2022 那種回撤，主推進取增長。一套主倉即可，不要再疊主題基金。",
      caution,
    };
  }

  return {
    id: "balanced",
    reason: "新單首 5 年或只能接受中度波動，主推均衡核心：少放現金、股票核心夠交手續費，回撤比進取溫和。",
    caution,
  };
}
