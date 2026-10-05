import { expect, test, type Locator } from '@playwright/test';
import { performanceOf, performancePost as post } from './content';
import { postUrl } from '../../src/lib/posts';
import { formatReturn, trendOf } from '../../src/lib/performance';

const performance = performanceOf(post);
const color = (locator: Locator, property: 'color' | 'fill') => locator.evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property);
const token = (locator: Locator, name: string) => locator.evaluate((element, variable) => {
  const probe = document.createElement('span');
  probe.style.color = `var(${variable})`;
  element.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}, name);

test('持仓收益图只展示实际记录，数据表、键盘选点和小屏布局可用', async ({ page }) => {
  if (!post || !performance) { test.skip(true, '没有配置收益记录的文章'); return; }
  const { points } = performance;
  await page.goto(postUrl(post.id));
  const chart = page.locator('[data-performance-chart]');
  const dots = chart.locator('[data-performance-point]');
  const readout = chart.locator('[data-record-return]');
  await expect(chart).toBeVisible();
  await expect(dots).toHaveCount(points.length);
  await expect(chart.locator('polyline')).toHaveCount(points.length > 1 ? 1 : 0);
  if (points.length === 1) await expect(chart).toContainText('暂以单点展示');
  await expect(readout).toHaveText(formatReturn(points.at(-1)!.returnPercent));
  await expect(readout).toHaveAttribute('data-trend', trendOf(points.at(-1)!.returnPercent));

  // Roving tabindex: the whole chart is one Tab stop, starting on the latest record.
  await expect(chart.locator('[data-performance-point][tabindex="0"]')).toHaveCount(1);
  await expect(dots.last()).toHaveAttribute('tabindex', '0');
  await expect(dots.last()).toHaveAttribute('aria-checked', 'true');
  await dots.last().focus();
  await page.keyboard.press('Home');
  await expect(dots.first()).toBeFocused();
  await expect(dots.first()).toHaveAttribute('tabindex', '0');
  await expect(chart.locator('[data-performance-point][tabindex="0"]')).toHaveCount(1);
  await expect(readout).toHaveText(formatReturn(points[0].returnPercent));
  await expect(readout).toHaveAttribute('data-trend', trendOf(points[0].returnPercent));
  if (points.length > 1) {
    await page.keyboard.press('ArrowRight');
    await expect(dots.nth(1)).toBeFocused();
    await expect(readout).toHaveText(formatReturn(points[1].returnPercent));
  }
  await page.keyboard.press('End');
  await expect(dots.last()).toBeFocused();
  await expect(readout).toHaveText(formatReturn(points.at(-1)!.returnPercent));
  // Tabbing away leaves the chart in one step.
  await page.keyboard.press('Tab');
  await expect(chart.locator('[data-performance-point]:focus')).toHaveCount(0);

  // Red for gains, green for losses, on the dots, the readout and the table.
  for (const [index, point] of points.entries()) {
    const trend = trendOf(point.returnPercent);
    await expect(dots.nth(index)).toHaveAttribute('data-trend', trend);
    if (trend === 'flat') continue;
    const expected = await token(chart, trend === 'gain' ? '--gain' : '--loss');
    expect(await color(dots.nth(index).locator('.point-dot'), 'fill')).toBe(expected);
  }
  const latestTrend = trendOf(points.at(-1)!.returnPercent);
  if (latestTrend !== 'flat') expect(await color(readout, 'color')).toBe(await token(chart, latestTrend === 'gain' ? '--gain' : '--loss'));

  await chart.locator('summary').click();
  await expect(chart.locator('tbody tr')).toHaveCount(points.length);
  for (const width of [320, 375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
});

test('禁用 JavaScript 后收益图及每日数据仍然可读', async ({ browser }) => {
  if (!post || !performance) { test.skip(true, '没有配置收益记录的文章'); return; }
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:4323${postUrl(post.id)}`);
    const chart = page.locator('[data-performance-chart]');
    await expect(chart.locator('svg')).toBeVisible();
    await expect(chart.locator('[data-performance-point][tabindex="0"]')).toHaveCount(1);
    await chart.locator('summary').click();
    await expect(chart.locator('tbody tr')).toHaveCount(performance.points.length);
  } finally { await context.close(); }
});
