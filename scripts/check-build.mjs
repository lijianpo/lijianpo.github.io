import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import matter from 'gray-matter';

const root = resolve('dist');
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? walk(resolve(dir, entry.name)) : resolve(dir, entry.name)))).flat();
}
const files = await walk(root);
const htmlFiles = files.filter((file) => file.endsWith('.html'));
const pages = new Map(await Promise.all(htmlFiles.map(async (file) => [file, await readFile(file, 'utf8')])));
const source = resolve('src/content/posts');
const drafts = [];
const published = [];
for (const file of await readdir(source)) {
  if (!file.endsWith('.md')) continue;
  const { data } = matter(await readFile(resolve(source, file), 'utf8'));
  const id = file.slice(0, -3);
  assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${file}: 文件名请使用英文小写字母、数字和短横线`);
  assert.equal(data.slug, undefined, `${file}: URL 使用文件名，不设置 slug`);
  if (data.draft) drafts.push(id);
  else published.push(id);
}
const rss = await readFile(resolve(root, 'rss.xml'), 'utf8');
const sitemaps = (await Promise.all(files.filter((file) => /sitemap.*\.xml$/.test(file)).map((file) => readFile(file, 'utf8')))).join('\n');
for (const id of drafts) {
  const draftPath = `/posts/${id}/`;
  assert(!files.includes(resolve(root, `posts/${id}/index.html`)), `草稿被生成：${id}`);
  for (const html of pages.values()) assert(!html.includes(draftPath), `页面泄漏草稿链接：${id}`);
  assert(!rss.includes(draftPath) && !sitemaps.includes(draftPath), `订阅或地图泄漏草稿：${id}`);
}
for (const id of published) {
  assert(pages.has(resolve(root, `posts/${id}/index.html`)), `缺少已发布文章：${id}`);
  assert(rss.includes(`/posts/${id}/`), `RSS 遗漏文章：${id}`);
}
let links = 0;
for (const [file, html] of pages) {
  const basePath = '/' + relative(root, file).replace(/index\.html$/, '');
  assert(html.includes('lang="zh-CN"'), `${file}: 缺少中文语言标记`);
  assert(/<link[^>]+rel="canonical"[^>]+https:\/\/lijianpo.github.io/.test(html), `${file}: canonical 地址错误`);
  for (const match of html.matchAll(/\b(?:href|src)="([^"#]+)(?:#[^"]*)?"/g)) {
    const raw = match[1].replace(/&amp;/g, '&');
    if (/^(https?:|data:|mailto:|tel:|javascript:)/.test(raw)) continue;
    const url = new URL(raw, 'https://lijianpo.github.io' + basePath);
    const path = decodeURIComponent(url.pathname);
    let target = resolve(root, '.' + path);
    try {
      if ((await stat(target)).isDirectory()) target = resolve(target, 'index.html');
      await stat(target);
    } catch { throw new Error(`${relative(root, file)} 包含无效链接：${raw}`); }
    links++;
  }
}
if (published.length) assert(files.includes(resolve(root, 'pagefind/pagefind.js')), '未生成搜索脚本');
assert(files.includes(resolve(root, '404.html')), '缺少 GitHub Pages 404 页面');
console.log(`构建检查通过：${pages.size} 个页面，${published.length} 篇文章，${drafts.length} 篇草稿已排除，${links} 个站内链接有效。`);
