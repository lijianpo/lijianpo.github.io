import { expect, type Locator } from '@playwright/test';
import { test } from './performance-fixture';

// Keep this file's tests in one worker so they share one isolated production build.
test.describe.configure({ mode: 'default' });

const records = [
  { date: '2026.09.30', value: '−8.44%', trend: 'loss', color: 'rgb(24, 128, 56)' },
  { date: '2026.10.01', value: '0.00%', trend: 'flat', color: null },
  { date: '2026.10.02', value: '+3.00%', trend: 'gain', color: 'rgb(217, 48, 37)' },
];

async function expectSelected(chart: Locator, index: number) {
  const dots = chart.locator('[data-performance-point]');
  await expect(dots.nth(index)).toBeFocused();
  await expect(dots.nth(index)).toHaveAttribute('aria-checked', 'true');
  await expect(dots.nth(index)).toHaveAttribute('tabindex', '0');
  await expect(chart.locator('[data-performance-point][tabindex="0"]')).toHaveCount(1);
  await expect(chart.locator('[data-performance-point][aria-checked="true"]')).toHaveCount(1);
  await expect(chart.locator('[data-record-date]')).toHaveText(records[index].date);
  await expect(chart.locator('[data-record-return]')).toHaveText(records[index].value);
}

test.beforeEach(async ({ page, performanceURL }) => {
  await page.goto(`${performanceURL}/posts/performance-multi/`);
});

test('固定多点数据按发布日截取，盈亏与零收益在图点、读数和表格中一致', async ({ page }) => {
  const chart = page.locator('[data-performance-chart]');
  const dots = chart.locator('[data-performance-point]');
  await expect(dots).toHaveCount(3);
  await expect(chart.locator('polyline')).toHaveCount(1);
  await expect(chart.locator('[data-record-return]')).toHaveText('+3.00%');
  await expect(chart.locator('[data-record-date]')).toHaveText('2026.10.02');
  await chart.locator('summary').click();
  await expect(chart.locator('tbody tr')).toHaveCount(3);
  await expect(chart.locator('tbody')).not.toContainText('2026-10-04');
  for (const [index, record] of records.entries()) {
    const point = dots.nth(index);
    const value = chart.locator('[data-record-return]');
    const cell = chart.locator('tbody tr').nth(index).locator('td').last();
    await point.click();
    await expectSelected(chart, index);
    await expect(value).toHaveAttribute('data-trend', record.trend);
    await expect(point).toHaveAttribute('data-trend', record.trend);
    await expect(cell).toHaveText(record.value);
    if (record.color) {
      await expect(point.locator('.point-dot')).toHaveCSS('fill', record.color);
      await expect(value).toHaveCSS('color', record.color);
      await expect(cell).toHaveCSS('color', record.color);
    } else {
      for (const color of records.flatMap((item) => item.color ? [item.color] : [])) {
        await expect(point.locator('.point-dot')).not.toHaveCSS('fill', color);
        await expect(value).not.toHaveCSS('color', color);
        await expect(cell).not.toHaveCSS('color', color);
      }
    }
  }
  for (const width of [320, 375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
});

test('多点键盘导航同步选择、读数和唯一 Tab 停留点', async ({ page }) => {
  const chart = page.locator('[data-performance-chart]');
  await chart.locator('[data-performance-point]').last().focus();
  await expectSelected(chart, 2);
  for (const [key, index] of [['Home', 0], ['ArrowRight', 1], ['ArrowDown', 2], ['ArrowLeft', 1], ['ArrowUp', 0], ['End', 2]] as const) {
    await page.keyboard.press(key);
    await expectSelected(chart, index);
  }
  await page.keyboard.press('Tab');
  await expect(chart.locator('summary')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expectSelected(chart, 2);
});

test('悬停只预览，移开恢复选择；鼠标与键盘混用仍可一次 Tab 离开', async ({ page }) => {
  const chart = page.locator('[data-performance-chart]');
  const dots = chart.locator('[data-performance-point]');
  const value = chart.locator('[data-record-return]');
  await dots.first().focus();
  await dots.last().hover();
  await expect(value).toHaveText('+3.00%');
  await expect(dots.last()).toHaveAttribute('data-preview', 'true');
  await expect(dots.last().locator('.point-halo')).toHaveCSS('opacity', '1');
  await expect(dots.first()).toBeFocused();
  await expect(dots.first()).toHaveAttribute('aria-checked', 'true');
  await expect(dots.first()).toHaveAttribute('tabindex', '0');
  await expect(dots.last()).toHaveAttribute('aria-checked', 'false');
  await expect(dots.last()).toHaveAttribute('tabindex', '-1');
  await page.mouse.move(0, 0);
  await expectSelected(chart, 0);
  await expect(chart.locator('[data-preview="true"]')).toHaveCount(0);
  await expect(dots.last().locator('.point-halo')).toHaveCSS('opacity', '0');

  await dots.last().hover();
  await page.keyboard.press('Tab');
  await expect(chart.locator('summary')).toBeFocused();
  await dots.last().focus();
  await dots.first().hover();
  await page.keyboard.press('Shift+Tab');
  await expect(chart.locator('[data-performance-point]:focus')).toHaveCount(0);

  await dots.nth(1).click();
  await expectSelected(chart, 1);
  await dots.first().hover();
  await page.mouse.move(0, 0);
  await expectSelected(chart, 1);
  for (const key of ['Enter', 'Space']) {
    await dots.first().hover();
    await page.keyboard.press(key);
    await expectSelected(chart, 1);
    await page.mouse.move(0, 0);
  }
});

test('显式截止日可截取单点；关闭 JavaScript 后单点和多点表格仍完整可读', async ({ browser, performanceURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    for (const [slug, count] of [['performance-multi', 3], ['performance-single', 1]] as const) {
      await page.goto(`${performanceURL}/posts/${slug}/`);
      const chart = page.locator('[data-performance-chart]');
      await expect(chart.locator('svg')).toBeVisible();
      await expect(chart.locator('[data-performance-point]')).toHaveCount(count);
      await expect(chart.locator('polyline')).toHaveCount(count === 1 ? 0 : 1);
      await expect(chart.locator('[data-record-return]')).toHaveText(records[count - 1].value);
      if (count === 1) await expect(chart).toContainText('暂以单点展示');
      await chart.locator('summary').click();
      await expect(chart.locator('tbody tr')).toHaveCount(count);
      for (let index = 0; index < count; index++) {
        await expect(chart.locator('tbody tr').nth(index)).toContainText(records[index].value);
      }
    }
  } finally { await context.close(); }
});
