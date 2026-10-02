import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDate, paginate, pageUrl, postUrl, readingMinutes, tagsWithCounts, tagUrl, visiblePosts } from '../src/lib/posts';

const post = (id: string, date: string, draft = false, tags: string[] = []) => ({
  id, data: { pubDate: new Date(date), draft, tags },
});

test('生产文章排除草稿，按日期倒序并保持相同日期的稳定顺序', () => {
  const source = [post('b', '2026-09-20'), post('private', '2026-10-01', true), post('a', '2026-09-20'), post('old', '2026-01-01')];
  assert.deepEqual(visiblePosts(source).map((item) => item.id), ['a', 'b', 'old']);
  assert.equal(source[0].id, 'b');
  assert.equal(visiblePosts(source, true)[0].id, 'private');
});

test('草稿独有标签不会进入生产标签列表，重复标签只计一次', () => {
  const posts = [post('a', '2026-10-01', false, ['技术', '技术', '随笔']), post('b', '2026-09-01', false, ['技术']), post('draft', '2026-09-02', true, ['草稿独有标签'])];
  assert.deepEqual(tagsWithCounts(visiblePosts(posts)), [{ name: '技术', count: 2 }, { name: '随笔', count: 1 }]);
});

test('分页覆盖空列表、整页与末页，不遗漏文章', () => {
  assert.deepEqual(paginate([]), [[]]);
  assert.equal(paginate(Array.from({ length: 10 }, (_, index) => index)).length, 1);
  const items = Array.from({ length: 21 }, (_, index) => index);
  const pages = paginate(items);
  assert.deepEqual(pages.map((page) => page.length), [10, 10, 1]);
  assert.deepEqual(pages.flat(), items);
  assert.throws(() => paginate([], 0));
  assert.equal(pageUrl(1), '/');
  assert.equal(pageUrl(2), '/page/2/');
});

test('中文与特殊字符链接保持单一路径段', () => {
  assert.equal(tagUrl('C++ / 技术'), '/tags/C%2B%2B%20%2F%20%E6%8A%80%E6%9C%AF/');
  assert.equal(postUrl('hello-world'), '/posts/hello-world/');
});

test('日期统一使用站点时区，跨年时归档年份保持一致', () => {
  assert.equal(formatDate(new Date('2026-12-31T17:00:00Z')), '2027.01.01');
  assert.equal(formatDate(new Date('2026-10-02')), '2026.10.02');
});

test('阅读时长覆盖中文、英文与空内容，代码块不计入正文', () => {
  assert.equal(readingMinutes(''), 1);
  assert.equal(readingMinutes('字'.repeat(701)), 3);
  assert.equal(readingMinutes('word '.repeat(221)), 2);
  assert.equal(readingMinutes('```ts\n' + 'word '.repeat(1000) + '\n```'), 1);
});
