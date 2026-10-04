import type { PerformanceData } from './content-schema';

export function formatReturn(value: number): string {
  const rounded = Math.round(Math.abs(value) * 100) / 100;
  const sign = rounded === 0 ? '' : value > 0 ? '+' : '−';
  return `${sign}${rounded.toFixed(2)}%`;
}

export function performancePlot(points: PerformanceData['points']) {
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
