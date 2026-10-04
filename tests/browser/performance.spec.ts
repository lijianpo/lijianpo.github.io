import { expect, test } from '@playwright/test';
import { posts } from './content';
import { postUrl } from '../../src/lib/posts';
import { formatReturn } from '../../src/lib/performance';

const post = posts.find((entry) => entry.data.performance);

test('持仓收益图只展示实际记录，数据表、键盘选点和小屏布局可用', async ({ page }) => {
  if (!post?.data.performance) { test.skip(true, '没有配置收益记录的文章'); return; }
  const { points } = post.data.performance;
  await page.goto(postUrl(post.id));
  const chart = page.locator('[data-performance-chart]');
  await expect(chart).toBeVisible();
  await expect(chart.locator('[data-performance-point]')).toHaveCount(points.length);
  await expect(chart.locator('polyline')).toHaveCount(points.length > 1 ? 1 : 0);
  if (points.length === 1) await expect(chart).toContainText('暂以单点展示');
  await expect(chart.locator('[data-record-return]')).toHaveText(formatReturn(points.at(-1)!.returnPercent));
  const first = chart.locator('[data-performance-point]').first();
  await first.focus();
  await expect(chart.locator('[data-record-return]')).toHaveText(formatReturn(points[0].returnPercent));
  await first.press('End');
  await expect(chart.locator('[data-record-return]')).toHaveText(formatReturn(points.at(-1)!.returnPercent));
  await chart.locator('summary').click();
  await expect(chart.locator('tbody tr')).toHaveCount(points.length);
  for (const width of [320, 375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
});

test('禁用 JavaScript 后收益图及每日数据仍然可读', async ({ browser }) => {
  if (!post?.data.performance) { test.skip(true, '没有配置收益记录的文章'); return; }
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:4323${postUrl(post.id)}`);
    const chart = page.locator('[data-performance-chart]');
    await expect(chart.locator('svg')).toBeVisible();
    await chart.locator('summary').click();
    await expect(chart.locator('tbody tr')).toHaveCount(post.data.performance.points.length);
  } finally { await context.close(); }
});
