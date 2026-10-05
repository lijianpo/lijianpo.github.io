import { cp, copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { TestContext } from 'node:test';
import matter from 'gray-matter';
import yaml from 'js-yaml';

// Real builds use isolated source and content, never the author's working tree.
export async function sourceTree() {
  await mkdir(resolve('.cache'), { recursive: true });
  const root = await mkdtemp(resolve('.cache/blog-test-'));
  const cleanup = () => rm(root, { recursive: true, force: true });
  try {
    for (const path of ['src', 'scripts', 'public', 'assets', 'astro.config.mjs', 'package.json', 'tsconfig.json']) {
      await cp(resolve(path), resolve(root, path), { recursive: true });
    }
    await symlink(resolve('node_modules'), resolve(root, 'node_modules'), 'dir');
    for (const path of ['src/content/posts', 'src/data/holdings']) {
      await rm(resolve(root, path), { recursive: true, force: true });
      await mkdir(resolve(root, path), { recursive: true });
    }
    return { root, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

export async function fixture(t: TestContext, fonts = false) {
  const root = await mkdtemp(resolve(tmpdir(), 'blog-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'src/content/posts'), { recursive: true });
  await mkdir(resolve(root, 'public/images'), { recursive: true });
  await mkdir(resolve(root, 'src/data/holdings'), { recursive: true });
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

export async function writeHolding(root: string, id: string, data: unknown) {
  await writeFile(resolve(root, `src/data/holdings/${id}.yaml`), typeof data === 'string' ? data : yaml.dump(data));
}

export const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="180" viewBox="0 0 720 180"><rect width="720" height="180" fill="#1967d2"/></svg>';
