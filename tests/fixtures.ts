import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { TestContext } from 'node:test';
import matter from 'gray-matter';

export async function fixture(t: TestContext, fonts = false) {
  const root = await mkdtemp(resolve(tmpdir(), 'blog-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'src/content/posts'), { recursive: true });
  await mkdir(resolve(root, 'public/images'), { recursive: true });
  if (fonts) {
    await mkdir(resolve(root, 'assets/fonts'), { recursive: true });
    await copyFile(resolve('assets/fonts/NotoSansCJKsc-Regular.otf'), resolve(root, 'assets/fonts/NotoSansCJKsc-Regular.otf'));
  }
  return root;
}

export async function writePost(root: string, id: string, data: Record<string, unknown> = {}, body = '文章正文。') {
  await writeFile(resolve(root, `src/content/posts/${id}.md`), matter.stringify(body, {
    title: '文章标题', description: '测试摘要', pubDate: '2026-10-03', ...data,
  }));
}

export const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="180" viewBox="0 0 720 180"><rect width="720" height="180" fill="#1967d2"/></svg>';
