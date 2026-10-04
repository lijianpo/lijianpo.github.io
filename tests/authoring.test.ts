import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { checkContent, createPost, imageReferences, readSourcePosts } from '../src/lib/content-files';
import { fixture, svg, writePost } from './fixtures';

test('新建草稿使用站点日期，安全保存特殊标题，拒绝覆盖和无效文件名', async (t) => {
  const root = await fixture(t);
  const title = '中文标题："引号" & 换行\n下一行';
  const file = await createPost('new-note', title, root, new Date('2026-12-31T17:00:00Z'));
  const posts = await readSourcePosts(root);
  assert.equal(posts[0].data.title, title);
  assert.equal(posts[0].data.draft, true);
  assert.equal(posts[0].data.pubDate.toISOString(), '2027-01-01T00:00:00.000Z');
  const before = await readFile(file, 'utf8');
  await assert.rejects(createPost('new-note', '另一个标题', root), /已存在/);
  assert.equal(await readFile(file, 'utf8'), before);
  await assert.rejects(createPost('../escape', '标题', root), /文件名/);
  await assert.rejects(createPost('empty-title', ' ', root), /标题/);
  await checkContent(root);
});

test('图片检查支持引用式 Markdown 与 HTML，忽略代码示例', () => {
  assert.deepEqual(imageReferences('![甲](/images/a.svg)\n![乙][b]\n\n[b]: /images/b.png\n\n<img src="/images/c.jpg">\n\n```md\n![不是真图](/images/missing.png)\n```'), ['/images/a.svg', '/images/b.png', '/images/c.jpg']);
});

test('草稿缺图提示，发布后缺图或损坏图片阻止构建并指出文章', async (t) => {
  const root = await fixture(t);
  await writePost(root, 'draft-note', { draft: true, cover: '/images/missing.png' });
  assert.match((await checkContent(root)).warnings[0], /draft-note\.md.*missing/);
  await writePost(root, 'published-note', {}, '![图](/images/missing.png)');
  await assert.rejects(checkContent(root), /published-note\.md.*missing/);
  await writeFile(resolve(root, 'public/images/missing.png'), 'not an image');
  await assert.rejects(checkContent(root), /published-note\.md/);
  await writePost(root, 'published-note', { cover: '/images/valid.svg' }, '正文。');
  await writeFile(resolve(root, 'public/images/valid.svg'), svg);
  assert.equal((await checkContent(root)).warnings.length, 1);
});

test('内容检查与 Astro 共用 schema，提前发现非法元数据和 slug', async (t) => {
  const root = await fixture(t);
  await writePost(root, 'invalid', { title: '', pubDate: 'not-a-date' });
  await assert.rejects(checkContent(root), /invalid\.md:.*title/);
  await writePost(root, 'invalid', { slug: 'renamed' });
  await assert.rejects(checkContent(root), /不设置 slug/);
  await writePost(root, 'invalid', { cover: '/images/../../package.json' });
  await assert.rejects(checkContent(root), /invalid\.md/);
});
