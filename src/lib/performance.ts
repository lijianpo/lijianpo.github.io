import { site } from '../site.config.ts';
import type { HoldingData, PerformanceRef } from './content-schema';

export type Trend = 'gain' | 'loss' | 'flat';

const rounded = (value: number) => Math.round(Math.abs(value) * 100) / 100;

export function formatReturn(value: number): string {
  const magnitude = rounded(value);
  const sign = magnitude === 0 ? '' : value > 0 ? '+' : '−';
  return `${sign}${magnitude.toFixed(2)}%`;
}

// Uses the same rounding as formatReturn, so a value shown as 0.00% is never colored.
export function trendOf(value: number): Trend {
  if (rounded(value) === 0) return 'flat';
  return value > 0 ? 'gain' : 'loss';
}

export function recordDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: site.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

// An article shows a fixed snapshot: records on or before `until`, defaulting to its publication day.
export function snapshotPerformance(holding: HoldingData, ref: PerformanceRef, pubDate: Date): HoldingData | null {
  const cutoff = ref.until ?? recordDay(pubDate);
  const points = holding.points.filter((point) => point.date <= cutoff);
  return points.length ? { ...holding, points } : null;
}

export function performancePlot(points: HoldingData['points']) {
  if (!points.length) throw new Error('收益图至少需要一条记录');
  const records = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const width = 600, height = 250, left = 64, right = 580, top = 20, bottom = 208;
  const min = Math.min(0, ...records.map((point) => point.returnPercent));
  const max = Math.max(0, ...records.map((point) => point.returnPercent));
  const span = Math.max(max - min, 1);
  const magnitude = 10 ** Math.floor(Math.log10(span / 4));
  const step = ([1, 2, 5, 10].find((factor) => factor * magnitude >= span / 4) ?? 10) * magnitude;
  const lower = Math.floor((min - span * 0.1) / step) * step;
  const upper = Math.ceil((max + span * 0.1) / step) * step;
  const y = (value: number) => bottom - (value - lower) / (upper - lower) * (bottom - top);
  const start = Date.parse(records[0].date), end = Date.parse(records.at(-1)!.date);
  const plotted = records.map((point) => ({
    ...point,
    x: start === end ? (left + right) / 2 : left + (Date.parse(point.date) - start) / (end - start) * (right - left),
    y: y(point.returnPercent),
    trend: trendOf(point.returnPercent),
  }));
  const ticks = Array.from({ length: Math.round((upper - lower) / step) + 1 }, (_, index) => {
    const value = Number((lower + index * step).toPrecision(12));
    return { value, y: y(value), label: `${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}%` };
  });
  return {
    width, height, left, right, bottom, ticks, points: plotted,
    line: plotted.length > 1 ? plotted.map((point) => `${point.x},${point.y}`).join(' ') : null,
  };
}
