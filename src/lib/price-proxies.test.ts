import assert from "node:assert/strict";
import { test } from "node:test";
import {
  allProxyCodes,
  coversRiskWindow,
  extendSeriesWithProxy,
  resolveRiskSeries,
  RISK_HISTORY_CUTOFF,
} from "./price-proxies";
import type { ChartPoint } from "./types";

const DAY = 86_400_000;

function pt(daysFromCutoff: number, price: number): ChartPoint {
  return { t: RISK_HISTORY_CUTOFF + daysFromCutoff * DAY, price };
}

test("coversRiskWindow requires a first price on or before 2022-01-01", () => {
  assert.equal(coversRiskWindow([]), false);
  assert.equal(coversRiskWindow([pt(0, 10)]), false);
  assert.equal(coversRiskWindow([pt(-1, 10), pt(400, 11)]), true);
  assert.equal(coversRiskWindow([pt(1, 10), pt(400, 11)]), false);
});

test("extendSeriesWithProxy prepends scaled proxy prices and keeps own prices", () => {
  const own = [pt(1400, 50), pt(1500, 52)];
  const proxy = [pt(-100, 10), pt(0, 12), pt(1399, 20), pt(1400, 21), pt(1500, 22)];
  const extended = extendSeriesWithProxy(own, proxy);
  assert.equal(extended[0].t, proxy[0].t);
  assert.equal(extended.at(-1)?.price, 52);
  assert.equal(extended.at(-2)?.price, 50);
  const lastBefore = proxy.filter((p) => p.t < own[0].t).at(-1);
  assert.ok(lastBefore);
  const scale = 50 / lastBefore.price;
  assert.ok(Math.abs(extended[0].price - proxy[0].price * scale) < 1e-10);
});

test("extendSeriesWithProxy uses the proxy wholesale when own series is empty", () => {
  const proxy = [pt(-10, 8), pt(10, 9)];
  const extended = extendSeriesWithProxy([], proxy);
  assert.deepEqual(extended, proxy);
});

test("resolveRiskSeries prefers a 2022-covering similar fund over a short twin", () => {
  const own = [pt(1400, 8), pt(1500, 8.2)];
  const twin = [pt(1400, 48), pt(1500, 47)];
  const similar = [pt(-400, 10), pt(0, 11), pt(1500, 12)];
  const charts = new Map<string, ChartPoint[]>([
    ["Z36", twin],
    ["B01", similar],
  ]);
  const resolved = resolveRiskSeries("W06", own, charts);
  assert.equal(resolved.omitted, false);
  assert.ok(resolved.proxy);
  assert.equal(resolved.proxy.proxyCode, "B01");
  assert.equal(resolved.proxy.kind, "similar");
  assert.match(resolved.proxy.reasonZh, /短債/);
  assert.ok(coversRiskWindow(resolved.points));
  assert.equal(resolved.points.at(-1)?.price, 8.2);
});

test("resolveRiskSeries omits a holding with no own prices and no usable proxy", () => {
  const resolved = resolveRiskSeries("Z77", [], new Map([["W07", []]]));
  assert.equal(resolved.omitted, true);
  assert.equal(resolved.proxy, null);
  assert.equal(resolved.points.length, 0);
});

test("allProxyCodes includes twins and similar funds for the four mixes", () => {
  const codes = allProxyCodes(["W06", "J20", "Z36", "Z29", "Z17", "Z77", "CG1"]);
  for (const needed of ["Z36", "B01", "Z20", "R03", "W06", "CG9", "M11", "I17", "J16", "W07"]) {
    assert.ok(codes.includes(needed), `missing ${needed}`);
  }
});
