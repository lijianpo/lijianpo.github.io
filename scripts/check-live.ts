import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, expect, type BrowserContext } from '@playwright/test';
import sharp from 'sharp';
import { site } from '../src/site.config.ts';
import { readSourcePosts } from '../src/lib/content-files.ts';
import { postUrl, visiblePosts } from '../src/lib/posts.ts';
import { inspectPage, xmlLocations } from '../src/lib/site-verification.ts';

const base = new URL(process.env.SITE_BASE_URL || site.url);
assert(['http:', 'https:'].includes(base.protocol), 'SITE_BASE_URL 必须是 HTTP(S) 地址');
const expected = process.env.EXPECT_COMMIT || process.env.GITHUB_SHA;
const duration = Number(process.env.SITE_VERIFY_TIMEOUT_MS || 120_000);
assert(Number.isFinite(duration) && duration >= 1000 && duration <= 120_000, '检查时限必须在 1000–120000 毫秒之间');
const deadline = Date.now() + duration;
const timeout = () => {
  const remaining = deadline - Date.now();
  assert(remaining > 0, '站点验证超时');
  return Math.min(10_000, remaining);
};
const posts = await readSourcePosts();
const published = visiblePosts(posts);
const first = published[0];
const bypass = [process.env.NO_PROXY, process.env.no_proxy, 'localhost', '127.0.0.1', '[::1]'].filter(Boolean).join(',');
process.env.NO_PROXY = process.env.no_proxy = bypass;

async function verify(context: BrowserContext) {
  const get = (path: string) => {
    const url = new URL(path, base);
    url.searchParams.set('_verify', `${expected || 'manual'}-${Date.now()}`);
    return context.request.get(url.href, { timeout: timeout(), headers: { 'Cache-Control': 'no-cache' } });
  };
  const text = async (path: string) => {
    const response = await get(path);
    assert.equal(response.status(), 200, `${path} HTTP 状态错误`);
    return response.text();
  };
  const info = JSON.parse(await text('/build-info.json'));
  assert(typeof info.revision === 'string' && info.revision, '缺少构建版本');
  if (expected) assert.equal(info.revision, expected, '线上仍是其他构建版本');
  const pages = ['/', ...(first ? [postUrl(first.id)] : [])];
  const images = new Set<string>();
  for (const path of pages) {
    const result = inspectPage(await text(path), path);
    images.add(result.image.pathname);
  }
  if (first) assert.equal(images.size, 2, '文章未使用独立分享图');
  for (const path of [...images, '/social-card.png']) {
    const response = await get(path);
    assert.equal(response.status(), 200, '分享图不可访问');
    assert.match(response.headers()['content-type'] || '', /^image\/png/, '分享图类型错误');
    const metadata = await sharp(await response.body()).metadata();
    assert.equal(metadata.width, 1200); assert.equal(metadata.height, 630);
  }
  const rss = await text('/rss.xml');
  assert(rss.includes('<rss'), 'RSS 响应不是订阅源');
  for (const post of published) assert(rss.includes(`${site.url}${postUrl(post.id)}`), `RSS 缺少 ${post.id}`);
  const index = await text('/sitemap-index.xml');
  const maps = xmlLocations(index);
  assert(maps.length > 0, '站点地图索引为空');
  let sitemap = index;
  for (const url of maps) {
    assert.equal(new URL(url).origin, site.url, '站点地图索引域名错误');
    sitemap += await text(new URL(url).pathname);
  }
  for (const url of xmlLocations(rss + sitemap)) assert.equal(new URL(url).origin, site.url, '订阅或地图域名错误');
  for (const post of published) assert(sitemap.includes(`${site.url}${postUrl(post.id)}`), `站点地图缺少 ${post.id}`);
  assert((await text('/robots.txt')).includes(`Sitemap: ${site.url}/sitemap-index.xml`), 'robots 站点地图地址错误');
  for (const post of posts.filter((post) => post.data.draft)) {
    const path = postUrl(post.id);
    assert(!rss.includes(path) && !sitemap.includes(path), 'RSS 或地图泄漏草稿');
    assert.equal((await get(path)).status(), 404, `草稿路由可访问：${post.id}`);
  }
  const page = await context.newPage();
  try {
    await page.goto(new URL(first ? postUrl(first.id) : '/', base).href, { timeout: timeout() });
    if (first) {
      await expect(page.locator('h1')).toHaveText(first.data.title, { timeout: timeout() });
      assert((await page.locator('.prose').innerText()).trim(), '文章正文为空');
      const searchable = published.find((post) => /[\p{Script=Han}]{4,8}/u.test(post.body)) ?? first;
      const query = searchable.body.match(/[\p{Script=Han}]{4,8}/u)?.[0] ?? searchable.data.title;
      await page.goto(new URL(`/search/?q=${encodeURIComponent(query)}`, base).href, { timeout: timeout() });
      await expect(page.locator(`.search-result a[href^="${postUrl(searchable.id)}"]`)).toBeVisible({ timeout: timeout() });
    } else {
      await page.goto(new URL('/search/?q=文章', base).href, { timeout: timeout() });
      await expect(page.locator('#search-status')).toContainText('还没有', { timeout: timeout() });
    }
  } finally { await page.close(); }
  return info.revision as string;
}

const browser = await chromium.launch();
try {
  let attempt = 0;
  while (true) {
    const context = await browser.newContext();
    try {
      const revision = await verify(context);
      console.log(`站点验证通过：${base.origin}，版本 ${revision}；文章、搜索、RSS、站点地图和分享图可用。`);
      break;
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      console.log(`第 ${++attempt} 次检查未通过，等待发布更新：${(error as Error).message.split('\n')[0]}`);
      await delay(Math.min(4000, deadline - Date.now()));
    } finally { await context.close(); }
  }
} catch (error) {
  console.error(`站点验证失败：${(error as Error).message}`);
  process.exitCode = 1;
} finally { await browser.close(); }
