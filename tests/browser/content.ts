import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import matter from 'gray-matter';
import { visiblePosts } from '../../src/lib/posts';
import { postSchema } from '../../src/lib/content-schema';
import { readHoldingsSync } from '../../src/lib/holdings';
import { snapshotPerformance } from '../../src/lib/performance';

// Read the current collection so adding articles or removing the starter does not break deployment.
const contentDir = resolve('src/content/posts');
export const entries = readdirSync(contentDir).filter((name) => name.endsWith('.md')).map((name) => {
  const { data, content } = matter(readFileSync(resolve(contentDir, name), 'utf8'));
  return {
    id: name.slice(0, -3), body: content,
    data: postSchema.parse(data),
  };
});
export const posts = visiblePosts(entries);
export const first = posts[0];
export const drafts = entries.filter((post) => post.data.draft);
export const chinesePost = posts.find((post) => /[\p{Script=Han}]{4,8}/u.test(post.body));
export const tocPost = posts.find((post) => /^## /m.test(post.body));
export const codePost = posts.find((post) => /^```/m.test(post.body));

// Same snapshot the article page renders: referenced holding, cut off at pubDate or `until`.
const holdings = readHoldingsSync();
export function performanceOf(post: (typeof entries)[number] | undefined) {
  const ref = post?.data.performance;
  const holding = ref && holdings.get(ref.holding);
  return ref && holding ? snapshotPerformance(holding, ref, post.data.pubDate) : null;
}
export const performancePost = posts.find((post) => performanceOf(post));
