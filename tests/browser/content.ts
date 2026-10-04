import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import matter from 'gray-matter';
import { visiblePosts } from '../../src/lib/posts';

// Read the current collection so adding articles or removing the starter does not break deployment.
const contentDir = resolve('src/content/posts');
export const entries = readdirSync(contentDir).filter((name) => name.endsWith('.md')).map((name) => {
  const { data, content } = matter(readFileSync(resolve(contentDir, name), 'utf8'));
  return {
    id: name.slice(0, -3), body: content,
    data: { title: String(data.title), description: String(data.description), pubDate: new Date(data.pubDate), tags: (data.tags ?? []) as string[], draft: data.draft === true, cover: data.cover as string | undefined },
  };
});
export const posts = visiblePosts(entries);
export const first = posts[0];
export const drafts = entries.filter((post) => post.data.draft);
export const chinesePost = posts.find((post) => /[\p{Script=Han}]{4,8}/u.test(post.body));
export const tocPost = posts.find((post) => /^## /m.test(post.body));
export const codePost = posts.find((post) => /^```/m.test(post.body));
