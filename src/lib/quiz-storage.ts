import {
  EMPTY_ANSWERS,
  type Drawdown,
  type Goal,
  type Horizon,
  type SuitabilityAnswers,
} from "./suitability";
import type { PortfolioId } from "./portfolios";

const ANSWERS_KEY = "ilps-quiz-answers-v1";
const OPEN_IDS_KEY = "ilps-quiz-open-v1";

const HORIZONS: readonly string[] = ["under5", "mid", "long"];
const GOALS: readonly string[] = ["income", "growth"];
const DRAWDOWNS: readonly string[] = ["cannot", "moderate", "can"];

function asHorizon(value: unknown): Horizon | null {
  return typeof value === "string" && HORIZONS.includes(value) ? (value as Horizon) : null;
}

function asGoal(value: unknown): Goal | null {
  return typeof value === "string" && GOALS.includes(value) ? (value as Goal) : null;
}

function asDrawdown(value: unknown): Drawdown | null {
  return typeof value === "string" && DRAWDOWNS.includes(value) ? (value as Drawdown) : null;
}

/** Pure validator: garbage in -> EMPTY_ANSWERS, never throws. */
export function parseQuizAnswers(raw: unknown): SuitabilityAnswers {
  if (typeof raw !== "object" || raw === null) return EMPTY_ANSWERS;
  const record = raw as Partial<Record<keyof SuitabilityAnswers, unknown>>;
  return {
    horizon: asHorizon(record.horizon),
    goal: asGoal(record.goal),
    drawdown: asDrawdown(record.drawdown),
  };
}

/** Pure validator for the manually expanded mix ids. */
export function parseOpenIds(raw: unknown, validIds: readonly PortfolioId[]): Set<PortfolioId> {
  const valid = new Set(validIds);
  if (!Array.isArray(raw)) return new Set();
  const ids = raw.filter(
    (item): item is PortfolioId => typeof item === "string" && valid.has(item as PortfolioId),
  );
  return new Set(ids);
}

function readKey(key: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function writeKey(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / quota exceeded: quiz just won't persist.
  }
}

export function loadQuizAnswers(): SuitabilityAnswers {
  const raw = readKey(ANSWERS_KEY);
  return raw == null ? EMPTY_ANSWERS : parseQuizAnswers(raw);
}

export function saveQuizAnswers(answers: SuitabilityAnswers): void {
  writeKey(ANSWERS_KEY, answers);
}

export function loadOpenIds(validIds: readonly PortfolioId[]): Set<PortfolioId> {
  const raw = readKey(OPEN_IDS_KEY);
  return raw == null ? new Set() : parseOpenIds(raw, validIds);
}

export function saveOpenIds(ids: Set<PortfolioId>): void {
  writeKey(OPEN_IDS_KEY, [...ids]);
}
