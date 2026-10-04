import { expect, test } from '@playwright/test';
import { posts, tocPost } from './content';
import { postUrl } from '../../src/lib/posts';
import { imageReferences } from '../../src/lib/content-files';
import { inspectPage } from '../../src/lib/site-verification';

const longPosts = [...posts].sort((a, b) => (b.data.title.length + b.data.description.length) - (a.data.title.length + a.data.description.length)).slice(0, 2);
for (const width of [375, 1440]) {
  test(`${width}px 长标题文章尽早进入正文，桌面目录不占据正文上方`, async ({ page }) => {
    test.skip(!longPosts.length, '没有已发布文章');
    await page.setViewportSize({ width, height: 1000 });
    for (const post of longPosts) {
      await page.goto(postUrl(post.id));
      const prose = await page.locator('.prose').boundingBox();
      expect(prose!.y).toBeLessThanOrEqual(width === 375 ? 650 : 600);
      expect(prose!.width).toBeLessThanOrEqual(740);
      if (width === 1440 && await page.locator('.toc').count()) {
        const toc = await page.locator('.toc').boundingBox();
        expect(toc!.x).toBeGreaterThan(prose!.x + prose!.width);
        expect(toc!.y).toBeCloseTo(prose!.y, 0);
      }
    }
  });
}

test('宽屏目录跟随滚动，当前章节在向下和向上滚动时保持同步', async ({ page }) => {
  if (!tocPost) { test.skip(); return; }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(postUrl(tocPost.id));
  const links = page.locator('.toc a');
  const count = await links.count();
  if (count < 2) { test.skip(true, '至少需要两个章节'); return; }
  for (const index of [1, 0]) {
    const link = links.nth(index);
    await link.click();
    await expect(link).toHaveAttribute('aria-current', 'location');
    await expect.poll(async () => (await page.locator('.toc').boundingBox())!.y).toBeCloseTo(104, 0);
    const target = (await link.getAttribute('href'))!.slice(1);
    await expect(page.locator(`[id="${target}"]`)).toBeInViewport();
  }
});

test('图片尚未返回时就预留完整高度，加载后下方内容不跳动', async ({ page }) => {
  const post = posts.find((post) => imageReferences(post.body).some((src) => src.startsWith('/images/')));
  if (!post) { test.skip(true, '文章中没有本地图片'); return; }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/images/**', async (route) => { await gate; await route.continue(); });
  await page.route('**/_generated/images/**', async (route) => { await gate; await route.continue(); });
  try {
    await page.goto(postUrl(post.id), { waitUntil: 'domcontentloaded' });
    const image = page.locator('.prose img').first();
    await image.scrollIntoViewIfNeeded();
    expect(await image.evaluate((node: HTMLImageElement) => node.complete)).toBe(false);
    const measure = () => image.evaluate((node: HTMLImageElement) => {
      const paragraph = node.closest('p') ?? node;
      const following = paragraph.nextElementSibling ?? paragraph;
      return { height: node.getBoundingClientRect().height, top: following.getBoundingClientRect().top + window.scrollY };
    });
    const before = await measure();
    expect(before.height).toBeGreaterThan(0);
    release();
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
    const after = await measure();
    expect(Math.abs(after.top - before.top)).toBeLessThanOrEqual(1);
    expect(after.height).toBeCloseTo(before.height, 0);
  } finally { release(); }
});

test('文章静态元数据使用独立分享图，图片可访问且不包含字体文件', async ({ request }) => {
  const targets = posts.slice(0, 2);
  test.skip(!targets.length, '没有已发布文章');
  const images = new Set<string>();
  for (const post of targets) {
    const path = postUrl(post.id);
    const html = await (await request.get(path)).text();
    const { image } = inspectPage(html, path);
    images.add(image.pathname);
    expect(html).not.toContain('.otf');
    const response = await request.get(image.pathname);
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('image/png');
  }
  expect(images.size).toBe(targets.length);
});
