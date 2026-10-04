import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { site } from '../src/site.config.ts';
import { readSourcePosts } from '../src/lib/content-files.ts';
import { attr, elements } from '../src/lib/html.ts';
import { inspectPage, xmlLocations } from '../src/lib/site-verification.ts';

const root = resolve('dist');
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? walk(resolve(dir, entry.name)) : resolve(dir, entry.name)))).flat();
}
const files = await walk(root);
const pages = new Map(await Promise.all(files.filter((file) => file.endsWith('.html')).map(async (file) => [file, await readFile(file, 'utf8')])));
const buildInfo = JSON.parse(await readFile(resolve(root, 'build-info.json'), 'utf8'));
assert(typeof buildInfo.revision === 'string' && buildInfo.revision, '缺少构建版本');
assert(typeof buildInfo.builtAt === 'string' && Number.isFinite(Date.parse(buildInfo.builtAt)), '缺少有效的编译时间');
assert.equal(new Date(buildInfo.builtAt).toISOString(), buildInfo.builtAt, '编译时间必须使用 UTC ISO 8601 格式');
const source = await readSourcePosts();
const drafts = source.filter((post) => post.data.draft);
const published = source.filter((post) => !post.data.draft);
const rss = await readFile(resolve(root, 'rss.xml'), 'utf8');
const sitemaps = (await Promise.all(files.filter((file) => /sitemap.*\.xml$/.test(file)).map((file) => readFile(file, 'utf8')))).join('\n');
for (const { id } of drafts) {
  const path = `/posts/${id}/`;
  assert(!pages.has(resolve(root, `posts/${id}/index.html`)), `草稿被生成：${id}`);
  for (const html of pages.values()) assert(!html.includes(path), `页面泄漏草稿链接：${id}`);
  assert(!rss.includes(path) && !sitemaps.includes(path), `订阅或地图泄漏草稿：${id}`);
  assert(!files.some((file) => new RegExp(`/${id}-[a-f0-9]{20}\\.png$`).test(file)), `草稿分享图被发布：${id}`);
}
for (const { id } of published) {
  assert(pages.has(resolve(root, `posts/${id}/index.html`)), `缺少已发布文章：${id}`);
  assert(rss.includes(`${site.url}/posts/${id}/`), `RSS 遗漏文章：${id}`);
}
for (const url of xmlLocations(rss + sitemaps)) assert.equal(new URL(url).origin, site.url, `RSS 或 sitemap 域名错误：${url}`);
const robots = await readFile(resolve(root, 'robots.txt'), 'utf8');
assert(robots.includes(`Sitemap: ${site.url}/sitemap-index.xml`), 'robots 的站点地图地址错误');

let links = 0;
for (const [file, html] of pages) {
  const path = '/' + relative(root, file).replaceAll(sep, '/').replace(/index\.html$/, '');
  const { nodes, image } = inspectPage(html, path);
  const footer = nodes.find((node) => attr(node, 'class')?.split(/\s+/).includes('footer-build'));
  assert(footer, `${path}: 缺少页脚构建信息`);
  const footerNodes = elements(footer);
  const revision = footerNodes.find((node) => attr(node, 'data-revision') !== undefined);
  const builtAt = footerNodes.find((node) => node.tagName === 'time');
  assert(revision && builtAt, `${path}: 页脚缺少版本或编译时间`);
  assert.equal(attr(revision, 'data-revision'), buildInfo.revision, `${path}: 页脚版本与构建信息不一致`);
  assert.equal(attr(revision, 'title'), buildInfo.revision, `${path}: 未保留完整提交号`);
  assert.equal(attr(builtAt, 'datetime'), buildInfo.builtAt, `${path}: 页脚编译时间与构建信息不一致`);
  const commit = buildInfo.revision.match(/^([a-f0-9]{40})(-dirty)?$/i);
  if (commit) assert.equal(attr(revision, 'href'), `${site.repository}/commit/${commit[1]}`, `${path}: 提交链接错误`);
  else assert.equal(attr(revision, 'href'), undefined, `${path}: 本地版本不应生成提交链接`);
  const references = [image.href];
  for (const node of nodes) {
    // Canonical metadata is checked above; Astro's error page has no /404/ route.
    if (node.tagName === 'link' && attr(node, 'rel') === 'canonical') continue;
    for (const name of ['href', 'src']) if (attr(node, name)) references.push(attr(node, name));
    const srcset = attr(node, 'srcset');
    if (srcset) references.push(...srcset.split(',').map((item) => item.trim().split(/\s+/)[0]));
    if (node.tagName === 'img' && attr(node, 'src')?.startsWith('/images/')) {
      assert(Number(attr(node, 'width')) > 0 && Number(attr(node, 'height')) > 0, `${path}: 图片未预留尺寸`);
    }
  }
  for (const raw of references) {
    const url = new URL(raw, site.url + path);
    if (url.origin !== site.url) continue;
    let target = resolve(root, '.' + decodeURIComponent(url.pathname));
    assert(target === root || target.startsWith(root + sep), `无效资源路径：${raw}`);
    try {
      if ((await stat(target)).isDirectory()) target = resolve(target, 'index.html');
      await stat(target);
    } catch { throw new Error(`${path} 包含无效链接：${raw}`); }
    if (url.hash && pages.has(target)) {
      const targetNodes = target === file ? nodes : inspectPage(pages.get(target), '/' + relative(root, target).replace(/index\.html$/, '')).nodes;
      assert(targetNodes.some((node) => attr(node, 'id') === decodeURIComponent(url.hash.slice(1))), `${path}: 章节链接无效 ${raw}`);
    }
    links++;
  }
}
if (published.length) assert(files.includes(resolve(root, 'pagefind/pagefind.js')), '未生成搜索脚本');
assert(files.includes(resolve(root, '404.html')), '缺少 GitHub Pages 404 页面');
console.log(`构建检查通过：${pages.size} 个页面，${published.length} 篇文章，${drafts.length} 篇草稿已排除，${links} 个站内引用有效；SEO 域名为 ${site.url}。`);
