import { readdirSync, readFileSync } from "fs";
import path from "path";

export const INVESTMENT_DISCLAIMER_ZH =
  "以上資料只供參考，不構成任何投資建議。投資涉及風險，基金價格可升可跌，過往表現不代表將來表現。";

export type FundMoveTag = "up" | "down" | "watch";

export type AffectedFund = {
  code: string;
  tag: FundMoveTag;
};

export type MarketPost = {
  slug: string;
  date: string;
  title: string;
  body: string;
  chart: string | null;
  funds: AffectedFund[];
  template: boolean;
  draft: boolean;
  source: string;
};

export type SpotlightPost = {
  slug: string;
  date: string;
  title: string | null;
  fundCode: string;
  why: string;
  suitedFor: string;
  risks: string;
  template: boolean;
  draft: boolean;
  source: string;
};

const FUND_CODE = /^[A-Za-z0-9]{2,8}$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string): boolean {
  const match = value.match(ISO_DATE);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function parseFundMoveTag(raw: string): FundMoveTag | null {
  const key = raw.trim().toLowerCase();
  if (["up", "升", "升勢", "↑", "upside"].includes(key)) return "up";
  if (["down", "跌", "跌勢", "↓", "downside"].includes(key)) return "down";
  if (["watch", "留意", "觀察", "flat", "中性"].includes(key)) return "watch";
  return null;
}

export function fundMoveLabelZh(tag: FundMoveTag): string {
  if (tag === "up") return "升";
  if (tag === "down") return "跌";
  return "留意";
}

export function parseAffectedFunds(raw: unknown): AffectedFund[] {
  if (raw == null || raw === "") return [];
  if (typeof raw === "string") {
    return raw
      .split(/[,，、]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [codeRaw, tagRaw] = part.split(/[:：]/).map((bit) => bit.trim());
        const tag = parseFundMoveTag(tagRaw ?? "watch") ?? "watch";
        return { code: (codeRaw ?? "").toUpperCase(), tag };
      })
      .filter((item) => FUND_CODE.test(item.code));
  }
  if (!Array.isArray(raw)) return [];
  const out: AffectedFund[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      out.push(...parseAffectedFunds(item));
      continue;
    }
    if (typeof item !== "object" || item == null) continue;
    const row = item as { code?: unknown; tag?: unknown };
    const code = typeof row.code === "string" ? row.code.trim().toUpperCase() : "";
    if (!FUND_CODE.test(code)) continue;
    out.push({ code, tag: parseFundMoveTag(String(row.tag ?? "watch")) ?? "watch" });
  }
  return out;
}

function truthyFlag(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value !== "string") return false;
  const key = value.trim().toLowerCase();
  return key === "true" || key === "yes" || key === "1";
}

export function splitFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n") && text !== "---") {
    return { meta: {}, body: text.trim() };
  }
  const rest = text.slice(4);
  const end = rest.indexOf("\n---");
  if (end < 0) return { meta: {}, body: text.trim() };
  const block = rest.slice(0, end);
  const body = rest.slice(end + 4).replace(/^\n/, "").trim();
  const meta: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colon = trimmed.indexOf(":");
    if (colon <= 0) continue;
    const key = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim().replace(/^["']|["']$/g, "");
    meta[key] = value;
  }
  return { meta, body };
}

export function isPublishedInsight(post: { slug: string; template: boolean; draft: boolean }): boolean {
  if (post.template || post.draft) return false;
  if (post.slug.startsWith("_")) return false;
  return true;
}

function readDirFiles(dir: string): { name: string; source: string; text: string }[] {
  let names: string[] = [];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((name) => name.endsWith(".md") || name.endsWith(".json"))
    .sort()
    .map((name) => {
      const source = path.join(dir, name);
      return { name, source, text: readFileSync(source, "utf-8") };
    });
}

export function parseMarketPost(text: string, fileName: string, source = fileName): MarketPost | null {
  const slug = fileName.replace(/\.(md|json)$/i, "");
  if (!slug) return null;
  let data: Record<string, unknown>;
  let body = "";
  if (fileName.toLowerCase().endsWith(".json")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (typeof parsed !== "object" || parsed == null || Array.isArray(parsed)) return null;
      data = parsed as Record<string, unknown>;
      body = typeof data.body === "string" ? data.body.trim() : "";
    } catch {
      return null;
    }
  } else {
    const split = splitFrontmatter(text);
    data = split.meta;
    body = split.body;
  }

  const date = typeof data.date === "string" ? data.date.trim() : "";
  const title = typeof data.title === "string" ? data.title.trim() : "";
  if (!isIsoDate(date) || !title) return null;
  const chartRaw = typeof data.chart === "string" ? data.chart.trim() : "";
  const chart = chartRaw ? (chartRaw.startsWith("/") ? chartRaw : `/${chartRaw.replace(/^public\//, "")}`) : null;

  return {
    slug,
    date,
    title,
    body,
    chart,
    funds: parseAffectedFunds(data.funds),
    template: truthyFlag(data.template) || slug.startsWith("_"),
    draft: truthyFlag(data.draft),
    source,
  };
}

export function parseSpotlightPost(text: string, fileName: string, source = fileName): SpotlightPost | null {
  const slug = fileName.replace(/\.(md|json)$/i, "");
  if (!slug) return null;
  let data: Record<string, unknown>;
  let why = "";
  if (fileName.toLowerCase().endsWith(".json")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (typeof parsed !== "object" || parsed == null || Array.isArray(parsed)) return null;
      data = parsed as Record<string, unknown>;
      why = typeof data.why === "string" ? data.why.trim() : typeof data.body === "string" ? data.body.trim() : "";
    } catch {
      return null;
    }
  } else {
    const split = splitFrontmatter(text);
    data = split.meta;
    why = split.body;
  }

  const date = typeof data.date === "string" ? data.date.trim() : "";
  const fundCode = typeof data.fund === "string" ? data.fund.trim().toUpperCase() : "";
  if (!isIsoDate(date) || !FUND_CODE.test(fundCode)) return null;
  const title = typeof data.title === "string" && data.title.trim() ? data.title.trim() : null;
  const suitedFor =
    typeof data.suitedFor === "string"
      ? data.suitedFor.trim()
      : typeof data.suited_for === "string"
        ? data.suited_for.trim()
        : "";
  const risks = typeof data.risks === "string" ? data.risks.trim() : "";

  return {
    slug,
    date,
    title,
    fundCode,
    why,
    suitedFor,
    risks,
    template: truthyFlag(data.template) || slug.startsWith("_"),
    draft: truthyFlag(data.draft),
    source,
  };
}

function marketDir(): string {
  return path.join(process.cwd(), "content", "market");
}

function spotlightDir(): string {
  return path.join(process.cwd(), "content", "spotlight");
}

function byNewest<T extends { date: string; slug: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.date === b.date ? b.slug.localeCompare(a.slug) : b.date.localeCompare(a.date)));
}

export function loadMarketPosts(includeUnpublished = false): MarketPost[] {
  const posts = readDirFiles(marketDir())
    .map((file) => parseMarketPost(file.text, file.name, file.source))
    .filter((post): post is MarketPost => post != null);
  const visible = includeUnpublished ? posts : posts.filter(isPublishedInsight);
  return byNewest(visible);
}

export function loadSpotlightPosts(includeUnpublished = false): SpotlightPost[] {
  const posts = readDirFiles(spotlightDir())
    .map((file) => parseSpotlightPost(file.text, file.name, file.source))
    .filter((post): post is SpotlightPost => post != null);
  const visible = includeUnpublished ? posts : posts.filter(isPublishedInsight);
  return byNewest(visible);
}

export function getMarketPost(slug: string, includeUnpublished = false): MarketPost | null {
  return loadMarketPosts(includeUnpublished).find((post) => post.slug === slug) ?? null;
}

export function getSpotlightPost(slug: string, includeUnpublished = false): SpotlightPost | null {
  return loadSpotlightPosts(includeUnpublished).find((post) => post.slug === slug) ?? null;
}

export function latestMarketHeadline(): { title: string; date: string; href: string } | null {
  const post = loadMarketPosts()[0];
  if (!post) return null;
  return { title: post.title, date: post.date, href: `/insights/market/${post.slug}` };
}

export function paragraphsFromBody(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((block) => block.replace(/\s+\n/g, "\n").trim())
    .filter(Boolean);
}

export function marketWhatsAppText(
  post: MarketPost,
  options: { origin?: string; fundNames?: Record<string, string> } = {},
): string {
  const origin = (options.origin ?? "").replace(/\/$/, "");
  const names = options.fundNames ?? {};
  const funds =
    post.funds.length === 0
      ? []
      : post.funds.map((item) => {
          const name = names[item.code] ? ` ${names[item.code]}` : "";
          const link = origin ? ` ${origin}/funds/${item.code}` : "";
          return `${item.code}${name} ${fundMoveLabelZh(item.tag)}${link}`;
        });
  return [
    `【市場短評】${post.date}`,
    post.title,
    "",
    post.body.trim(),
    "",
    funds.length > 0 ? `受影響基金：\n${funds.join("\n")}` : "受影響基金：見研究台",
    "",
    INVESTMENT_DISCLAIMER_ZH,
  ].join("\n");
}

export function spotlightWhatsAppText(input: {
  date: string;
  code: string;
  name: string;
  why: string;
  suitedFor: string;
  risks: string;
  metrics: string[];
  origin?: string;
}): string {
  const origin = (input.origin ?? "").replace(/\/$/, "");
  const link = origin ? `${origin}/funds/${input.code}` : `/funds/${input.code}`;
  return [
    `【基金焦點】${input.date}`,
    `${input.code} ${input.name}`,
    link,
    "",
    input.why.trim(),
    "",
    input.suitedFor ? `適合：${input.suitedFor}` : null,
    input.risks ? `主要風險：${input.risks}` : null,
    "",
    ...input.metrics,
    "",
    INVESTMENT_DISCLAIMER_ZH,
  ]
    .filter((line) => line != null)
    .join("\n");
}
