import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, readdir, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { sourceTree, writeHolding, writePost } from './fixtures';
import { attr, documentElements } from '../src/lib/html';
import { checkContent } from '../src/lib/content-files';

const exec = promisify(execFile);

test('真实构建刷新未改动 Markdown 的图片尺寸和哈希；删除文章后清理资源并支持空站点', { timeout: 90_000 }, async (t) => {
  const { root, cleanup } = await sourceTree();
  t.after(cleanup);
  await writePost(root, 'photo-note', { cover: '/images/photo.jpg' }, '一段测试正文。\n\n## 图片\n\n![照片](/images/photo.jpg)');
  await writePost(root, 'private-draft', { draft: true, cover: '/images/not-ready.jpg' });
  const photo = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: '#1967d2' } }).jpeg().toFile(resolve(root, 'public/images/photo.jpg'));
  const build = async () => {
    try {
      await exec(process.execPath, [resolve('node_modules/astro/bin/astro.mjs'), 'build'], { cwd: root, timeout: 25_000 });
      await exec(process.execPath, ['scripts/build-search.mjs'], { cwd: root, timeout: 10_000 });
      await exec(process.execPath, ['scripts/check-build.mjs'], { cwd: root, timeout: 10_000 });
    } catch (error) {
      const result = error as Error & { stdout?: string; stderr?: string };
      throw new Error([result.message, result.stdout, result.stderr].filter(Boolean).join('\n'));
    }
  };
  const image = async () => documentElements(await readFile(resolve(root, 'dist/posts/photo-note/index.html'), 'utf8'))
    .find((node) => node.tagName === 'img' && attr(node, 'alt') === '照片')!;
  await photo(1000, 500);
  await build();
  const firstBuild = JSON.parse(await readFile(resolve(root, 'dist/build-info.json'), 'utf8'));
  assert.equal(attr(await image(), 'height'), '500');
  const firstAssets = await readdir(resolve(root, 'dist/_generated/images'));
  assert(firstAssets.length > 0);
  await photo(800, 600);
  await build();
  const secondBuild = JSON.parse(await readFile(resolve(root, 'dist/build-info.json'), 'utf8'));
  assert.equal(secondBuild.revision, firstBuild.revision, '未提交代码时构建版本不应改变');
  assert(Date.parse(secondBuild.builtAt) > Date.parse(firstBuild.builtAt), '重新构建未更新编译时间');
  assert.equal(attr(await image(), 'width'), '800');
  assert.equal(attr(await image(), 'height'), '600');
  const secondAssets = await readdir(resolve(root, 'dist/_generated/images'));
  assert(firstAssets.every((file) => !secondAssets.includes(file)), '产物包含旧图片版本');
  await rm(resolve(root, 'src/content/posts/photo-note.md'));
  await build();
  assert(!(await readdir(resolve(root, 'dist'))).includes('pagefind'));
  assert(!(await readdir(resolve(root, 'dist/_generated'))).includes('images'));
  assert((await readdir(resolve(root, 'dist/_generated/social'))).every((file) => file.startsWith('site-')));
});

test('开发预览中替换图片后自动刷新尺寸和可访问的 WebP 地址', { timeout: 50_000 }, async (t) => {
  const { root, cleanup } = await sourceTree();
  t.after(cleanup);
  await writePost(root, 'photo-note', { draft: true }, '![照片](/images/photo.jpg)');
  const photo = (width: number) => sharp({ create: { width, height: 200, channels: 3, background: '#1967d2' } }).jpeg().toFile(resolve(root, 'public/images/photo.jpg'));
  await photo(600);
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = (socket.address() as { port: number }).port;
  await new Promise<void>((done) => socket.close(() => done()));
  const server = spawn(process.execPath, [resolve('node_modules/astro/bin/astro.mjs'), 'dev', '--host', '127.0.0.1', '--port', String(port), '--ignore-lock'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '';
  server.stdout.on('data', (chunk) => { logs = (logs + String(chunk)).slice(-6000); });
  server.stderr.on('data', (chunk) => { logs = (logs + String(chunk)).slice(-6000); });
  const exit = once(server, 'exit');
  const waitForImage = async (width: number) => {
    const deadline = Date.now() + 18_000;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/posts/photo-note/`, { signal: AbortSignal.timeout(2000) });
        const nodes = documentElements(await response.text());
        const image = nodes.find((node) => node.tagName === 'img' && attr(node, 'alt') === '照片');
        if (image && attr(image, 'width') === String(width)) {
          const source = nodes.find((node) => node.tagName === 'source');
          assert(source);
          const url = attr(source, 'srcset')!.split(' ')[0];
          const resource = await fetch(`http://127.0.0.1:${port}${url}`, { signal: AbortSignal.timeout(2000) });
          assert.equal(resource.status, 200);
          assert.equal(resource.headers.get('content-type'), 'image/webp');
          return url;
        }
      } catch { /* Vite may be starting or restarting after the image replacement. */ }
      assert(server.exitCode === null, `开发服务退出：${logs}`);
      await delay(250);
    }
    throw new Error(`图片未更新到 ${width}px：${logs}`);
  };
  try {
    const initial = await waitForImage(600);
    await photo(800);
    assert.notEqual(await waitForImage(800), initial);
  } finally {
    server.kill('SIGTERM');
    const kill = setTimeout(() => server.kill('SIGKILL'), 3000);
    await exit;
    clearTimeout(kill);
  }
});

test('真实构建按 YAML 和 YML 文件名引用持仓，额外 slug 不会让收益图消失', { timeout: 45_000 }, async (t) => {
  const { root, cleanup } = await sourceTree();
  t.after(cleanup);
  for (const extension of ['yaml', 'yml']) {
    const id = `holding-${extension}`;
    await writeHolding(root, id, {
      label: '文件名持仓', basis: '测试数据', slug: `ignored-${extension}`,
      points: [{ date: '2026-09-30', returnPercent: -8.44 }],
    });
    if (extension === 'yml') await rename(resolve(root, `src/data/holdings/${id}.yaml`), resolve(root, `src/data/holdings/${id}.yml`));
    await writePost(root, `note-${extension}`, { performance: id });
  }
  await checkContent(root);
  const build = () => exec(process.execPath, [resolve('node_modules/astro/bin/astro.mjs'), 'build'], { cwd: root, timeout: 25_000 });
  await build();
  for (const extension of ['yaml', 'yml']) {
    const nodes = documentElements(await readFile(resolve(root, `dist/posts/note-${extension}/index.html`), 'utf8'));
    assert(nodes.some((node) => node.tagName === 'figure' && attr(node, 'aria-label') === '文件名持仓'));
    assert(nodes.some((node) => attr(node, 'data-date') === '2026.09.30' && attr(node, 'data-return') === '−8.44%'));
  }
  await writePost(root, 'slug-note', { performance: 'ignored-yaml' });
  await assert.rejects(checkContent(root), /找不到持仓文件.*ignored-yaml/);
  await assert.rejects(build(), /找不到持仓文件.*ignored-yaml/);
});
