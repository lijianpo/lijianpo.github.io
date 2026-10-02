import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import matter from 'gray-matter';
import { site } from '../../src/site.config';
import { formatDate, postUrl, visiblePosts } from '../../src/lib/posts';

// Read the current collection so adding articles or removing the starter does not break deployment.
const contentDir = resolve('src/content/posts');
const entries = readdirSync(contentDir).filter((name) => name.endsWith('.md')).map((name) => {
  const { data, content } = matter(readFileSync(resolve(contentDir, name), 'utf8'));
  return {
    id: name.slice(0, -3), body: content,
    data: { title: String(data.title), pubDate: new Date(data.pubDate), tags: (data.tags ?? []) as string[], draft: data.draft === true },
  };
});
const posts = visiblePosts(entries);
const first = posts[0];
const drafts = entries.filter((post) => post.data.draft);
const chinesePost = posts.find((post) => /[\p{Script=Han}]{4,8}/u.test(post.body));
const tocPost = posts.find((post) => /^## /m.test(post.body));
const codePost = posts.find((post) => /^```/m.test(post.body));

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
    if (first) paths.push(postUrl(first.id));
    for (const path of paths) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path).toBeTruthy();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
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
  await context.close();
});
