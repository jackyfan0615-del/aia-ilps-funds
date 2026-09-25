import assert from "node:assert/strict";
import { test } from "node:test";
import { validateChartPoints } from "./aia";

const DAY = 86_400_000;

function chartRows(count: number, lastAgeDays = 1): [number, number][] {
  const last = Date.now() - lastAgeDays * DAY;
  return Array.from(
    { length: count },
    (_, i) => [last - (count - 1 - i) * DAY, 100 + i] as [number, number],
  );
}

test("accepts a well-formed fresh chart", () => {
  const points = validateChartPoints(chartRows(120));
  assert.ok(points);
  assert.equal(points.length, 120);
});

test("rejects non-array payloads", () => {
  assert.equal(validateChartPoints({ foo: 1 }), null);
  assert.equal(validateChartPoints(null), null);
  assert.equal(validateChartPoints("nope"), null);
});

test("rejects charts with fewer than 60 usable points", () => {
  assert.equal(validateChartPoints(chartRows(59)), null);
  assert.equal(validateChartPoints([]), null);
});

test("sorts out-of-order timestamps ascending", () => {
  const points = validateChartPoints([...chartRows(90)].reverse());
  assert.ok(points);
  assert.equal(points.length, 90);
  for (let i = 1; i < points.length; i += 1) {
    assert.ok(points[i].t > points[i - 1].t);
  }
});

test("rejects a stale series whose last point is over 10 days old", () => {
  assert.equal(validateChartPoints(chartRows(90, 11)), null);
});

test("accepts a 9-day-old last point (weekend + holiday gaps)", () => {
  assert.ok(validateChartPoints(chartRows(90, 9)));
});

test("drops invalid rows and still validates when enough remain", () => {
  const rows = chartRows(90);
  rows.push(["bad", "row"] as unknown as [number, number]);
  rows.push([rows[0][0], -5] as [number, number]);
  const points = validateChartPoints(rows);
  assert.ok(points);
  assert.equal(points.length, 90);
});
