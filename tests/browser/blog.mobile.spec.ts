import { expect, test } from '@playwright/test';
import { first, chinesePost, codePost, tocPost, posts, performanceOf, performancePost } from './content';
import { postUrl } from '../../src/lib/posts';
import { formatReturn, trendOf } from '../../src/lib/performance';

test('iPhone 上列表与卡片切换后保持偏好，封面和正文正常显示', async ({ page }) => {
  await page.goto('/');
  if (!first) { await expect(page.locator('.empty-state')).toBeVisible(); return; }
  const list = page.getByRole('button', { name: '列表', exact: true });
  const cards = page.getByRole('button', { name: '卡片', exact: true });
  await expect(list).toHaveAttribute('aria-pressed', 'true');
  const image = await page.locator('.post-artwork-link').first().boundingBox();
  const summary = await page.locator('.post-summary').first().boundingBox();
  expect(image!.x + image!.width).toBeLessThan(summary!.x);
  await cards.tap();
  await page.reload();
  await expect(cards).toHaveAttribute('aria-pressed', 'true');
  const covered = posts.find((post) => post.data.cover);
  if (covered) {
    const cover = page.locator(`.post-artwork-link[href="${postUrl(covered.id)}"] img`);
    if (await cover.count()) {
      await cover.scrollIntoViewIfNeeded();
      await expect.poll(() => cover.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
    }
  }
  await list.tap();
  await page.locator('.post-title-line a').first().tap();
  await expect(page.locator('h1')).toHaveText(first.data.title);
  expect((await page.locator('.prose').boundingBox())!.y).toBeLessThanOrEqual(650);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('iPhone 折叠目录可触摸跳转，中文正文搜索可以命中', async ({ page }) => {
  if (tocPost) {
    await page.goto(postUrl(tocPost.id));
    await expect(page.locator('.toc-details')).not.toHaveAttribute('open');
    await page.locator('.toc summary').tap();
    const link = page.locator('.toc a').first();
    const target = (await link.getAttribute('href'))!.slice(1);
    await link.tap();
    await expect(page.locator(`[id="${target}"]`)).toBeInViewport();
  }
  if (!chinesePost) { test.skip(true, '没有中文正文'); return; }
  const query = chinesePost.body.match(/[\p{Script=Han}]{4,8}/u)![0];
  await page.goto(`/search/?q=${encodeURIComponent(query)}`);
  await expect(page.locator(`.search-result a[href^="${postUrl(chinesePost.id)}"]`)).toBeVisible();
  await page.getByRole('searchbox').fill('qzzxv987654321');
  await expect(page.locator('#search-status')).toContainText('没有找到');
});

test('iPhone 无剪贴板权限时选中代码并提示手动复制', async ({ page }) => {
  if (!codePost) { test.skip(true, '没有代码块'); return; }
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new DOMException('denied', 'NotAllowedError'); } } });
  });
  await page.goto(postUrl(codePost.id));
  const code = await page.locator('.prose pre code').first().textContent();
  await page.getByRole('button', { name: '复制代码' }).first().tap();
  await expect(page.getByRole('button', { name: '复制代码' }).first()).toHaveText('请手动复制');
  expect(await page.evaluate(() => getSelection()?.toString())).toBe(code);
});

test('iPhone 上收益图可触摸选点，并展开每日数据', async ({ page }) => {
  const post = performancePost;
  const performance = performanceOf(post);
  if (!post || !performance) { test.skip(true, '没有配置收益记录的文章'); return; }
  await page.goto(postUrl(post.id));
  const chart = page.locator('[data-performance-chart]');
  await chart.locator('[data-performance-point]').first().tap();
  await expect(chart.locator('[data-record-return]')).toHaveText(formatReturn(performance.points[0].returnPercent));
  await expect(chart.locator('[data-record-return]')).toHaveAttribute('data-trend', trendOf(performance.points[0].returnPercent));
  await expect(chart.locator('[data-performance-point]').first()).toHaveAttribute('tabindex', '0');
  await chart.locator('summary').tap();
  await expect(chart.locator('tbody tr')).toHaveCount(performance.points.length);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
