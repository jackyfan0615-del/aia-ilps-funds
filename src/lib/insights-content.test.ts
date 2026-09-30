import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  fundMoveLabelZh,
  isPublishedInsight,
  loadMarketPosts,
  loadSpotlightPosts,
  marketWhatsAppText,
  parseAffectedFunds,
  parseMarketPost,
  parseSpotlightPost,
  splitFrontmatter,
  spotlightWhatsAppText,
  INVESTMENT_DISCLAIMER_ZH,
} from "./insights-content";

const marketTemplate = readFileSync(path.join(process.cwd(), "content/market/_template.md"), "utf-8");
const spotlightTemplate = readFileSync(path.join(process.cwd(), "content/spotlight/_template.md"), "utf-8");

test("parses market markdown frontmatter and skips unpublished templates", () => {
  const post = parseMarketPost(marketTemplate, "_template.md");
  assert.ok(post);
  assert.equal(post.date, "2026-10-05");
  assert.match(post.title, /範本/);
  assert.equal(post.chart, "/market/_template.svg");
  assert.deepEqual(
    post.funds.map((item) => `${item.code}:${item.tag}`),
    ["CG1:up", "I07:down", "Z07:watch"],
  );
  assert.equal(post.template, true);
  assert.equal(isPublishedInsight(post), false);
  assert.match(post.body, /不是真實週報/);
});

test("parses JSON market posts and compact fund tags", () => {
  const json = JSON.stringify({
    date: "2026-10-12",
    title: "實測短評",
    body: "股市與債市一段。",
    funds: [
      { code: "h01", tag: "升" },
      { code: "W04", tag: "跌" },
    ],
  });
  const post = parseMarketPost(json, "2026-10-12.json");
  assert.ok(post);
  assert.equal(isPublishedInsight(post), true);
  assert.equal(post.funds[0].code, "H01");
  assert.equal(post.funds[0].tag, "up");
  assert.equal(fundMoveLabelZh("down"), "跌");
});

test("parses spotlight template and WhatsApp copy includes disclaimer", () => {
  const post = parseSpotlightPost(spotlightTemplate, "_template.md");
  assert.ok(post);
  assert.equal(post.fundCode, "CG1");
  assert.match(post.suitedFor, /資本增值/);
  assert.equal(isPublishedInsight(post), false);
  const text = spotlightWhatsAppText({
    date: post.date,
    code: post.fundCode,
    name: "環球股票",
    why: post.why,
    suitedFor: post.suitedFor,
    risks: post.risks,
    metrics: ["近1年 +1.2%"],
    origin: "https://aia-ilps-funds.vercel.app",
  });
  assert.match(text, /【基金焦點】/);
  assert.match(text, /CG1/);
  assert.match(text, /https:\/\/aia-ilps-funds.vercel.app\/funds\/CG1/);
  assert.match(text, new RegExp(INVESTMENT_DISCLAIMER_ZH));
});

test("splitFrontmatter keeps body after closing fence", () => {
  const { meta, body } = splitFrontmatter("---\ntitle: 測試\n---\n第一段\n\n第二段\n");
  assert.equal(meta.title, "測試");
  assert.match(body, /第一段/);
});

test("parseAffectedFunds accepts comma string", () => {
  assert.deepEqual(parseAffectedFunds("CG1:升, I07:跌"), [
    { code: "CG1", tag: "up" },
    { code: "I07", tag: "down" },
  ]);
});

test("market WhatsApp text is plain and includes funds plus disclaimer", () => {
  const post = parseMarketPost(marketTemplate, "_template.md");
  assert.ok(post);
  const text = marketWhatsAppText(post, {
    origin: "https://example.com",
    fundNames: { CG1: "環球股票" },
  });
  assert.doesNotMatch(text, /<[^>]+>/);
  assert.match(text, /CG1 環球股票 升 https:\/\/example.com\/funds\/CG1/);
  assert.match(text, /I07 跌/);
  assert.match(text, new RegExp(INVESTMENT_DISCLAIMER_ZH));
});

test("rejects market posts without a date or title", () => {
  assert.equal(parseMarketPost("---\ntitle: 無日期\n---\n文字\n", "x.md"), null);
  assert.equal(parseMarketPost("---\ndate: 2026-13-40\ntitle: 壞日期\n---\n文字\n", "x.md"), null);
});

test("loadMarketPosts and loadSpotlightPosts hide filename templates", () => {
  assert.equal(loadMarketPosts().some((post) => post.slug.startsWith("_")), false);
  assert.equal(loadSpotlightPosts().some((post) => post.slug.startsWith("_")), false);
  assert.ok(loadMarketPosts(true).some((post) => post.slug === "_template"));
});
