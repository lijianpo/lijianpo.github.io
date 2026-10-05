import { expect } from '@playwright/test';
import { test } from './performance-fixture';

test('iPhone 上固定多点收益图可逐点触摸选择，移开后保持选择', async ({ page, performanceURL }) => {
  await page.goto(`${performanceURL}/posts/performance-multi/`);
  const chart = page.locator('[data-performance-chart]');
  const dots = chart.locator('[data-performance-point]');
  await expect(dots).toHaveCount(3);
  for (const [index, value] of ['−8.44%', '0.00%', '+3.00%'].entries()) {
    await dots.nth(index).tap();
    await expect(dots.nth(index)).toBeFocused();
    await expect(dots.nth(index)).toHaveAttribute('aria-checked', 'true');
    await expect(dots.nth(index)).toHaveAttribute('tabindex', '0');
    await expect(chart.locator('[data-performance-point][tabindex="0"]')).toHaveCount(1);
    await expect(chart.locator('[data-record-return]')).toHaveText(value);
    await expect(chart.locator('[data-preview="true"]')).toHaveCount(0);
    await chart.locator('h2').tap();
    await expect(chart.locator('[data-record-return]')).toHaveText(value);
  }
  await chart.locator('summary').tap();
  await expect(chart.locator('tbody tr')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
