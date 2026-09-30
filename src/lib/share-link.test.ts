import assert from "node:assert/strict";
import { test } from "node:test";
import { PORTFOLIO_TEMPLATES } from "./portfolios";
import {
  buildSharePath,
  currentQuarterLabel,
  encodeShareHash,
  encodeShareSearch,
  formatQuarterZh,
  holdingsFromPortfolioId,
  parseShareHash,
  parseShareSearch,
  quarterEndTs,
  quarterStartTs,
} from "./share-link";

test("round-trips fund codes, weights, start date and quarter in the query string", () => {
  const payload = {
    holdings: [
      { code: "z07", weight: 10 },
      { code: "Z36", weight: 25 },
      { code: "Z13", weight: 10 },
      { code: "Z18", weight: 30 },
      { code: "Z17", weight: 25 },
    ],
    startDate: "2024-03-15",
    quarter: "2026q3",
  };
  const encoded = encodeShareSearch(payload);
  assert.match(encoded, /h=/);
  assert.match(encoded, /s=2024-03-15/);
  assert.match(encoded, /q=2026Q3/);
  assert.doesNotMatch(encoded, /name|陳|client/i);
  const parsed = parseShareSearch(encoded);
  assert.ok(!("error" in parsed));
  if ("error" in parsed) return;
  assert.equal(parsed.startDate, "2024-03-15");
  assert.equal(parsed.quarter, "2026Q3");
  assert.equal(parsed.holdings.find((item) => item.code === "Z07")?.weight, 10);
  const sum = parsed.holdings.reduce((total, item) => total + item.weight, 0);
  assert.ok(Math.abs(sum - 100) < 0.2);
});

test("legacy income share query still parses after the mix change", () => {
  const parsed = parseShareSearch("h=Z07:25,Z36:20,Z77:20,Z29:15,Z17:20&s=2024-03-15&q=2026Q3");
  assert.ok(!("error" in parsed));
  if ("error" in parsed) return;
  assert.equal(parsed.holdings.find((item) => item.code === "Z77")?.weight, 20);
  assert.equal(parsed.holdings.find((item) => item.code === "Z29")?.weight, 15);
  const sum = parsed.holdings.reduce((total, item) => total + item.weight, 0);
  assert.ok(Math.abs(sum - 100) < 0.2);
});

test("display name lives only in the URL fragment", () => {
  const path = buildSharePath(
    {
      holdings: PORTFOLIO_TEMPLATES[1].sleeves,
      startDate: "2023-06-01",
      quarter: "2026Q1",
    },
    "陳大文",
  );
  assert.match(path, /^\/share\?/);
  assert.match(path, /#n=/);
  const [search, hash] = path.split("#");
  assert.doesNotMatch(search, /陳|name=/);
  assert.equal(parseShareHash(`#${hash}`), "陳大文");
  assert.equal(parseShareHash(encodeShareHash(" 李四 ")), "李四");
});

test("ignores a client name if someone puts it in the query string", () => {
  const parsed = parseShareSearch("h=CG1:50,H01:50&s=2024-01-01&q=2026Q2&name=秘密客人");
  assert.ok(!("error" in parsed));
  assert.doesNotMatch(JSON.stringify(parsed), /秘密/);
});

test("rejects weights that do not sum to 100 and bad quarters", () => {
  assert.equal("error" in parseShareSearch("h=CG1:40,H01:40&s=2024-01-01&q=2026Q2"), true);
  assert.equal("error" in parseShareSearch("h=CG1:100&s=2024-01-01&q=2026Q5"), true);
  assert.equal("error" in parseShareSearch("h=CG1:100&s=13/01/2024&q=2026Q1"), true);
});

test("quarter helpers use calendar quarters in HKT", () => {
  assert.equal(formatQuarterZh("2026Q3"), "2026年第3季");
  const start = quarterStartTs("2026Q3");
  const end = quarterEndTs("2026Q3");
  assert.ok(start != null && end != null);
  assert.equal(new Date(start).toISOString().slice(0, 10), "2026-06-30");
  assert.equal(new Date(end).toISOString().slice(0, 10), "2026-09-30");
  assert.match(currentQuarterLabel(new Date("2026-09-30T04:00:00.000Z")), /2026Q3/);
});

test("model portfolio helper emits the five sleeves", () => {
  const income = holdingsFromPortfolioId("income");
  assert.equal(income.length, 5);
  assert.equal(income.reduce((sum, item) => sum + item.weight, 0), 100);
});
