import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { getImageAsset } from '../src/lib/image-assets';
import { getSocialImage } from '../src/lib/social-images';
import { publishAssets, transformImages } from '../src/integrations/blog-assets';
import { fragmentElements, attr } from '../src/lib/html';
import { fixture, svg, writePost } from './fixtures';

test('照片生成多尺寸 WebP，不放大小图；缓存复用且换图后地址变化', async (t) => {
  const root = await fixture(t);
  const path = resolve(root, 'public/images/photo.jpg');
  const makePhoto = (background: string) => sharp({ create: { width: 1500, height: 1000, channels: 3, background } }).jpeg().toFile(path);
  await makePhoto('#1967d2');
  const first = await getImageAsset('/images/photo.jpg', root);
  assert.deepEqual(first.variants.map((image) => image.width), [320, 640, 960, 1280, 1500]);
  const initial = await stat(first.variants[0].file);
  for (const image of first.variants) {
    const metadata = await sharp(image.file).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.width, image.width);
  }
  assert.deepEqual(await getImageAsset('/images/photo.jpg', root), first);
  assert.equal((await stat(first.variants[0].file)).mtimeMs, initial.mtimeMs);
  await makePhoto('#ea4335');
  assert.notEqual((await getImageAsset('/images/photo.jpg', root)).variants[0].url, first.variants[0].url);
  await sharp({ create: { width: 80, height: 40, channels: 3, background: '#fff' } }).png().toFile(resolve(root, 'public/images/small.png'));
  assert.deepEqual((await getImageAsset('/images/small.png', root)).variants.map((image) => image.width), [80]);
});

test('处理照片方向，SVG 与动画保留原格式和单帧比例', async (t) => {
  const root = await fixture(t);
  await writeFile(resolve(root, 'public/images/diagram.svg'), svg);
  const vector = await getImageAsset('/images/diagram.svg', root);
  assert.equal(vector.width, 720); assert.equal(vector.height, 180); assert.deepEqual(vector.variants, []);
  await sharp({ create: { width: 600, height: 400, channels: 3, background: '#fff' } }).withMetadata({ orientation: 6 }).jpeg().toFile(resolve(root, 'public/images/rotated.jpg'));
  const rotated = await getImageAsset('/images/rotated.jpg', root);
  assert.equal(rotated.width, 400); assert.equal(rotated.height, 600);
  const frame = await sharp({ create: { width: 20, height: 10, channels: 4, background: '#1967d2' } }).png().toBuffer();
  const secondFrame = await sharp({ create: { width: 20, height: 10, channels: 4, background: '#ea4335' } }).png().toBuffer();
  await sharp([frame, secondFrame], { join: { animated: true } }).gif().toFile(resolve(root, 'public/images/animation.gif'));
  assert.equal((await sharp(resolve(root, 'public/images/animation.gif')).metadata()).pages, 2);
  const animation = await getImageAsset('/images/animation.gif', root);
  assert.equal(animation.width, 20); assert.equal(animation.height, 10); assert.deepEqual(animation.variants, []);
});

test('正文图片在静态 HTML 里获得尺寸、响应式来源和正确的加载顺序', async (t) => {
  const root = await fixture(t);
  await writeFile(resolve(root, 'public/images/diagram.svg'), svg);
  await sharp({ create: { width: 100, height: 50, channels: 3, background: '#fff' } }).png().toFile(resolve(root, 'public/images/photo.png'));
  const nodes = fragmentElements(await transformImages('<p><img src="/images/diagram.svg" alt="流程"></p><img src="/images/photo.png" alt="照片">', root));
  const [first, image] = nodes.filter((node) => node.tagName === 'img');
  assert.equal(attr(first, 'height'), '180'); assert.equal(attr(first, 'loading'), 'eager');
  assert(nodes.some((node) => node.tagName === 'picture'));
  assert.match(attr(nodes.find((node) => node.tagName === 'source')!, 'srcset')!, /100w/);
  assert.equal(attr(image, 'width'), '100'); assert.equal(attr(image, 'loading'), 'lazy');
});

test('中文长标题分享图可生成，标题变动更新地址，生产只输出已发布资源', async (t) => {
  const root = await fixture(t, true);
  const post = { id: 'long-title', data: { title: '中文标题与英文 Astro：<标签> & "引用" '.repeat(5), pubDate: new Date('2026-10-03') } };
  const card = await getSocialImage(post, root);
  const metadata = await sharp(card.file).metadata();
  assert.equal(metadata.width, 1200); assert.equal(metadata.height, 630); assert.equal(metadata.format, 'png');
  assert.notEqual((await getSocialImage({ ...post, data: { ...post.data, title: '新的标题' } }, root)).url, card.url);
  await writePost(root, 'published');
  await writePost(root, 'private-draft', { draft: true });
  await getSocialImage({ id: 'private-draft', data: post.data }, root);
  const output = resolve(root, 'dist');
  await mkdir(output);
  const buildInfo = { revision: 'a'.repeat(40), builtAt: '2026-10-04T12:30:00.000Z' };
  await publishAssets(root, output, buildInfo);
  const files = await readdir(resolve(output, '_generated/social'));
  assert(files.some((file) => file.startsWith('published-')));
  assert(!files.some((file) => file.startsWith('private-draft-') || file.startsWith('long-title-')));
  assert((await readFile(resolve(output, 'social-card.png'))).length > 0);
  assert.deepEqual(JSON.parse(await readFile(resolve(output, 'build-info.json'), 'utf8')), buildInfo);
});
