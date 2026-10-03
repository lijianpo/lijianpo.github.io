import { expect, test, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import matter from 'gray-matter';
import { site } from '../../src/site.config';
import { formatDate, postUrl, tagUrl, visiblePosts } from '../../src/lib/posts';

// Read the current collection so adding articles or removing the starter does not break deployment.
const contentDir = resolve('src/content/posts');
const entries = readdirSync(contentDir).filter((name) => name.endsWith('.md')).map((name) => {
  const { data, content } = matter(readFileSync(resolve(contentDir, name), 'utf8'));
  return {
    id: name.slice(0, -3), body: content,
    data: { title: String(data.title), pubDate: new Date(data.pubDate), tags: (data.tags ?? []) as string[], draft: data.draft === true, cover: data.cover as string | undefined },
  };
});
const posts = visiblePosts(entries);
const first = posts[0];
const drafts = entries.filter((post) => post.data.draft);
const chinesePost = posts.find((post) => /[\p{Script=Han}]{4,8}/u.test(post.body));
const tocPost = posts.find((post) => /^## /m.test(post.body));
const codePost = posts.find((post) => /^```/m.test(post.body));

async function expectListImagesOnLeft(page: Page) {
  const width = page.viewportSize()!.width;
  const expectedImageWidth = width <= 700 ? 96 : width <= 1000 ? 160 : 220;
  const rows = await page.locator('.post-list > li').evaluateAll((items) => items.map((item) => {
    const image = item.querySelector('.post-artwork-link')!.getBoundingClientRect();
    const summary = item.querySelector('.post-summary')!.getBoundingClientRect();
    return { imageWidth: image.width, imageHeight: image.height, imageRight: image.right, textLeft: summary.left, imageTop: image.top, textTop: summary.top };
  }));
  for (const row of rows) {
    expect(row.imageWidth).toBeCloseTo(expectedImageWidth, 0);
    expect(row.imageWidth / row.imageHeight).toBeCloseTo(1.5, 1);
    expect(row.imageRight).toBeLessThan(row.textLeft);
    expect(row.imageTop).toBeCloseTo(row.textTop, 0);
  }
}

test('视图切换保留文章、支持键盘操作并跨刷新和分页记住选择', async ({ page }) => {
  if (!first) { test.skip(true, '当前没有已发布文章'); return; }
  await page.goto('/');
  const listButton = page.getByRole('button', { name: '列表', exact: true });
  const cardsButton = page.getByRole('button', { name: '卡片', exact: true });
  await expect(listButton).toHaveAttribute('aria-pressed', 'true');
  await expectListImagesOnLeft(page);
  const originalLinks = await page.locator('.post-title-line a').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  await page.locator('.post-list').evaluate((list) => { list.setAttribute('data-preserved-dom', 'true'); });
  await cardsButton.focus();
  await page.keyboard.press('Enter');
  await expect(cardsButton).toHaveAttribute('aria-pressed', 'true');
  await expect(listButton).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.post-list')).toHaveAttribute('data-preserved-dom', 'true');
  expect(await page.locator('.post-title-line a').evaluateAll((links) => links.map((link) => link.getAttribute('href')))).toEqual(originalLinks);
  await page.reload();
  await expect(cardsButton).toHaveAttribute('aria-pressed', 'true');

  if (posts.length > site.pageSize) {
    await page.getByRole('link', { name: '下一页 →' }).click();
    await expect(page).toHaveURL('/page/2/');
    await expect(cardsButton).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.post-list > li')).toHaveCount(Math.min(site.pageSize, posts.length - site.pageSize));
    await listButton.focus();
    await page.keyboard.press('Space');
    await expect(listButton).toHaveAttribute('aria-pressed', 'true');
    await expectListImagesOnLeft(page);
    await page.reload();
    await expect(listButton).toHaveAttribute('aria-pressed', 'true');
    await page.goBack();
    await expect(page).toHaveURL('/');
    await expect(listButton).toHaveAttribute('aria-pressed', 'true');
    await expectListImagesOnLeft(page);
  } else {
    await listButton.click();
  }
  await page.locator('.post-title-line a').first().click();
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '文章', exact: true }).click();
  await expect(listButton).toHaveAttribute('aria-pressed', 'true');
});

test('已保存的卡片视图在交互脚本运行前恢复', async ({ page }) => {
  if (!first) { test.skip(true, '当前没有已发布文章'); return; }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => localStorage.setItem('blog-post-view', 'cards'));
  // Astro can inline small modules, so pausing network scripts alone is insufficient.
  await page.route('**/', async (route) => {
    const response = await route.fetch();
    const html = (await response.text()).replace(/<script\b[^>]*\btype=["']module["'][^>]*>[\s\S]*?<\/script>/g, '');
    await route.fulfill({ response, body: html });
  });
  await page.route('**/*.js', (route) => route.abort());
  await page.goto('/');
  const image = await page.locator('.post-featured .post-artwork-link').boundingBox();
  const text = await page.locator('.post-featured .post-summary').boundingBox();
  expect(image!.x).toBeGreaterThan(text!.x);
  await expect(page.getByRole('group', { name: '文章显示方式' })).toBeHidden();
});

test('存储不可用时仍可切换，未知偏好回退到列表', async ({ page }) => {
  if (!first) { test.skip(true, '当前没有已发布文章'); return; }
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    try { localStorage.setItem('blog-post-view', 'unknown'); } catch { /* Another fixture may block storage. */ }
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '列表', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expectListImagesOnLeft(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage is disabled', 'SecurityError'); } });
  });
  await page.reload();
  await expect(page.getByRole('button', { name: '列表', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '卡片', exact: true }).click();
  await expect(page.getByRole('button', { name: '卡片', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '列表', exact: true }).click();
  await expectListImagesOnLeft(page);
  expect(errors).toEqual([]);
});

test('文章独立封面在列表、卡片和标签页共用，未配置时显示插画', async ({ page }) => {
  const covered = posts.slice(0, site.pageSize).find((post) => post.data.cover);
  if (!covered) { test.skip(true, '首页没有配置封面的文章'); return; }
  await page.goto('/');
  const image = page.locator(`.post-artwork-link[href="${postUrl(covered.id)}"] img.post-cover`);
  await image.scrollIntoViewIfNeeded();
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute('src', covered.data.cover!);
  await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
  const fallback = posts.slice(0, site.pageSize).find((post) => !post.data.cover);
  if (fallback) {
    const thumbnail = page.locator(`.post-artwork-link[href="${postUrl(fallback.id)}"]`);
    await expect(thumbnail.locator('img')).toHaveCount(0);
    await expect(thumbnail.locator('svg')).toBeVisible();
  }
  await page.getByRole('button', { name: '卡片', exact: true }).click();
  await image.scrollIntoViewIfNeeded();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
  if (covered.data.tags.length) {
    await page.goto(tagUrl(covered.data.tags[0]));
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveAttribute('src', covered.data.cover!);
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator('.post-list-switchable')).toHaveCount(0);
    await expect(page.getByRole('group', { name: '文章显示方式' })).toHaveCount(0);
  }
});

test('封面加载失败时恢复插画并保留图片空间', async ({ page }) => {
  const covered = posts.slice(0, site.pageSize).find((post) => post.data.cover);
  if (!covered) { test.skip(true, '首页没有配置封面的文章'); return; }
  await page.route(`**${covered.data.cover}`, (route) => route.abort());
  await page.goto('/');
  const thumbnail = page.locator(`.post-artwork-link[href="${postUrl(covered.id)}"]`);
  await thumbnail.scrollIntoViewIfNeeded();
  await expect(thumbnail.locator('img')).toHaveAttribute('hidden', '');
  await expect(thumbnail.locator('svg')).toBeVisible();
  await expectListImagesOnLeft(page);
  await page.getByRole('button', { name: '卡片', exact: true }).click();
  await expect(thumbnail.locator('img')).toBeHidden();
  await expect(thumbnail.locator('svg')).toBeVisible();
});

test('首页、中文标签与归档可导航到真实文章', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(`${site.name} · ${site.tagline}`);
  await expect(page.locator('.post-list > li')).toHaveCount(Math.min(posts.length, site.pageSize));
  if (!first) { await expect(page.locator('.empty-state')).toBeVisible(); return; }
  await page.locator('.post-title-line a').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(first.data.title);
  if (first.data.tags.length) {
    await page.locator('.article-heading .post-tags a').first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`# ${first.data.tags[0]}`);
  }
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '归档' }).click();
  await expect(page.locator('.archive-year h2').first()).toContainText(formatDate(first.data.pubDate).slice(0, 4));
  await page.locator('.archive-year a').first().click();
  await expect(page).toHaveURL(postUrl(first.id));
});

test('搜索可命中中文正文和英文代码，支持直达查询与空结果', async ({ page }) => {
  if (!chinesePost) { test.skip(true, '当前没有中文文章'); return; }
  const query = chinesePost.body.match(/[\p{Script=Han}]{4,8}/u)![0];
  await page.goto(`/search/?q=${encodeURIComponent(query)}`);
  await expect(page.locator('#search-status')).toContainText(/找到 \d+ 篇相关文章/);
  await expect(page.locator(`.search-result a[href^="${postUrl(chinesePost.id)}"]`)).toBeVisible();
  const identifier = codePost?.body.match(/(?:const|function)\s+([a-zA-Z_]\w*)/)?.[1];
  if (identifier) {
    await page.getByRole('searchbox').fill(identifier);
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(identifier);
    await expect(page.locator('.search-result mark').first()).toContainText(new RegExp(identifier, 'i'));
  }
  await page.getByRole('searchbox').fill('qzzxv987654321');
  await expect(page.locator('#search-status')).toContainText('没有找到');
  await expect(page.locator('.search-result')).toHaveCount(0);
  await page.getByRole('searchbox').fill('');
  await expect(page.locator('#search-start')).toBeVisible();
  await expect(page).toHaveURL(/\/search\/$/);
});

test('搜索索引不可用时显示恢复提示并可重试', async ({ page }) => {
  if (!first) { test.skip(true, '当前没有已发布文章'); return; }
  await page.route('**/pagefind/pagefind.js*', (route) => route.abort());
  await page.goto('/search/');
  await page.getByRole('searchbox').fill(first.data.title);
  await expect(page.locator('#search-status')).toContainText('搜索暂时无法加载');
  await expect(page.getByRole('button', { name: /搜索/ })).toBeEnabled();
  await page.unroute('**/pagefind/pagefind.js*');
  await page.getByRole('button', { name: /搜索/ }).click();
  await expect(page.locator('.search-result').first()).toBeVisible();
});

test('生产网站、搜索、RSS 和地图均不泄漏草稿', async ({ page, request }) => {
  for (const draft of drafts) {
    const response = await request.get(postUrl(draft.id));
    expect(response.status()).toBe(404);
    if (posts.length) {
      await page.goto(`/search/?q=${encodeURIComponent(draft.data.title)}`);
      await expect(page.locator('#search-status')).toContainText(/找到/);
      await expect(page.locator(`.search-result a[href^="${postUrl(draft.id)}"]`)).toHaveCount(0);
    }
  }
  for (const path of ['/rss.xml', '/sitemap-0.xml', '/tags/', '/archives/']) {
    const data = await request.get(path);
    expect(data.ok()).toBeTruthy();
    const body = await data.text();
    for (const draft of drafts) expect(body).not.toContain(postUrl(draft.id));
  }
  const rss = await request.get('/rss.xml');
  if (first) expect(await rss.text()).toContain(`https://lijianpo.github.io${postUrl(first.id)}`);
});

test('代码复制、桌面目录和键盘搜索快捷键可用', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 1440, height: 1000 });
  if (codePost) {
    await page.goto(postUrl(codePost.id));
    const code = await page.locator('.prose pre code').first().textContent();
    await page.getByRole('button', { name: '复制代码' }).first().click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
    await expect(page.getByRole('button', { name: '复制代码' }).first()).toHaveText('已复制 ✓');
  }
  if (tocPost) {
    await page.goto(postUrl(tocPost.id));
    const link = page.getByRole('navigation', { name: '章节导航' }).getByRole('link').first();
    const target = await link.getAttribute('href');
    await link.click();
    expect(decodeURIComponent(new URL(page.url()).hash)).toBe(target);
  }
  if (!codePost && !tocPost) await page.goto('/');
  await page.keyboard.press('/');
  await expect(page).toHaveURL(/\/search\/$/);
  await expect(page.getByRole('searchbox')).toBeFocused();
});

test('手机端目录展开后可跳转，导航始终可达', async ({ page }) => {
  if (!tocPost) { test.skip(true, '当前文章没有章节标题'); return; }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(postUrl(tocPost.id));
  const details = page.locator('.toc-details');
  await expect(details).not.toHaveAttribute('open');
  await page.getByText('本篇目录', { exact: false }).click();
  await expect(details).toHaveAttribute('open', '');
  const link = page.getByRole('navigation', { name: '章节导航' }).getByRole('link').first();
  const target = await link.getAttribute('href');
  await link.click();
  await expect(page.locator(`[id="${target!.slice(1)}"]`)).toBeInViewport();
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '关于' })).toBeVisible();
});

for (const width of [320, 375, 768, 1440]) {
  test(`${width}px 页面无整页横向溢出或资源错误`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const failures: string[] = [];
    page.on('pageerror', (error) => failures.push(error.message));
    page.on('response', (response) => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
    const paths = ['/', '/tags/', '/archives/', '/about/', '/search/'];
    if (posts.length > site.pageSize) paths.push('/page/2/');
    if (first) paths.push(postUrl(first.id));
    for (const path of paths) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path).toBeTruthy();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (first && (path === '/' || path === '/page/2/')) {
        await expectListImagesOnLeft(page);
        await page.getByRole('button', { name: '卡片', exact: true }).click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} 卡片模式`).toBeTruthy();
        await page.getByRole('button', { name: '列表', exact: true }).click();
        await expectListImagesOnLeft(page);
      }
    }
    expect(failures).toEqual([]);
  });
}

test('不存在的页面返回真实 404，并提供返回入口', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('这条路暂时没有文字。');
  await page.getByRole('link', { name: '返回文章列表' }).click();
  await expect(page).toHaveURL('/');
});

test('禁用 JavaScript 时文章、导航、目录和 RSS 仍可用', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const article = tocPost ?? first;
  await page.goto(`http://127.0.0.1:4323${article ? postUrl(article.id) : '/'}`);
  if (article) await expect(page.getByRole('heading', { level: 1 })).toHaveText(article.data.title);
  if (tocPost) await expect(page.getByRole('navigation', { name: '章节导航' })).toBeVisible();
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '文章', exact: true }).click();
  await expect(page.locator('.post-list > li')).toHaveCount(Math.min(posts.length, site.pageSize));
  await expect(page.getByRole('group', { name: '文章显示方式' })).toBeHidden();
  await expectListImagesOnLeft(page);
  await context.close();
});
