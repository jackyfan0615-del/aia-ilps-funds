"use client";

import { useMemo, useState } from "react";
import {
  CHART_PERIODS,
  downsample,
  formatChartDate,
  formatPrice,
  periodStats,
  sliceChart,
} from "@/lib/chart";
import type { ChartPeriod, ChartPoint } from "@/lib/types";

type Props = {
  points: ChartPoint[];
  currency: string;
};

function buildPath(points: ChartPoint[], width: number, height: number, pad: number) {
  if (points.length === 0) {
    return { line: "", area: "" };
  }
  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const coords = points.map((point, index) => {
    const x = pad + (index / Math.max(points.length - 1, 1)) * innerW;
    const y = pad + (1 - (point.price - min) / span) * innerH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = `M ${coords.join(" L ")}`;
  const lastX = pad + innerW;
  const baseY = pad + innerH;
  const firstX = pad;
  const area = `${line} L ${lastX.toFixed(1)},${baseY.toFixed(1)} L ${firstX.toFixed(1)},${baseY.toFixed(1)} Z`;
  return { line, area };
}

export function PriceTrend({ points, currency }: Props) {
  const [period, setPeriod] = useState<ChartPeriod>("1Y");
  const sliced = useMemo(() => sliceChart(points, period), [points, period]);
  const drawn = useMemo(() => downsample(sliced, 180), [sliced]);
  const stats = useMemo(() => periodStats(sliced), [sliced]);
  const path = useMemo(() => buildPath(drawn, 640, 240, 16), [drawn]);
  const recent = useMemo(() => [...sliced].reverse().slice(0, 12), [sliced]);
  const up = stats.changePct >= 0;

  if (points.length === 0) {
    return <p className="empty">暫時未能載入走勢圖，請稍後再試。</p>;
  }

  return (
    <section className="trend-panel">
      <div className="period-tabs" role="tablist" aria-label="走勢期間">
        {CHART_PERIODS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={period === item.id}
            className={period === item.id ? "active" : undefined}
            onClick={() => setPeriod(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="trend-stats">
        <div>
          <p className="price-label">期間回報</p>
          <p className={`trend-change ${up ? "is-up" : "is-down"}`}>
            {up ? "+" : ""}
            {stats.changePct.toFixed(2)}%
          </p>
        </div>
        <div>
          <p className="price-label">期間高低</p>
          <p className="trend-range">
            {currency}
            {formatPrice(stats.min)} – {currency}
            {formatPrice(stats.max)}
          </p>
        </div>
        <div>
          <p className="price-label">期間</p>
          <p className="trend-range">
            {formatChartDate(stats.start)} 至 {formatChartDate(stats.end)}
          </p>
        </div>
      </div>

      <div className="chart-wrap">
        <svg
          viewBox="0 0 640 240"
          role="img"
          aria-label={`${period} 賣出價走勢，期間回報 ${stats.changePct.toFixed(2)}%`}
        >
          <path d={path.area} className={up ? "chart-area is-up" : "chart-area is-down"} />
          <path d={path.line} className={up ? "chart-line is-up" : "chart-line is-down"} />
        </svg>
      </div>

      <h3 className="detail-h">近期賣出價</h3>
      <div className="price-table-wrap">
        <table className="price-table">
          <thead>
            <tr>
              <th>估值日期</th>
              <th>賣出價</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((point) => (
              <tr key={point.t}>
                <td>{formatChartDate(point.t)}</td>
                <td>
                  {currency}
                  {formatPrice(point.price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
