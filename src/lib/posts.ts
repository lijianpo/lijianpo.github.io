import { site } from '../site.config';

export interface PostLike {
  id: string;
  data: {
    pubDate: Date;
    tags: string[];
    draft: boolean;
  };
}

export function visiblePosts<T extends PostLike>(posts: T[], includeDrafts = false): T[] {
  return posts
    .filter((post) => includeDrafts || !post.data.draft)
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf() || a.id.localeCompare(b.id));
}

export function paginate<T>(items: T[], size: number = site.pageSize): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new Error('每页条数必须为正整数');
  return Array.from({ length: Math.max(1, Math.ceil(items.length / size)) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

export function tagsWithCounts(posts: PostLike[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of new Set(post.data.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts].map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, site.language));
}

export function formatDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: site.timeZone,
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}.${part('month')}.${part('day')}`;
}

export function readingMinutes(markdown: string): number {
  const text = markdown.replace(/```[\s\S]*?```/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  const chinese = (text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu) ?? []).length;
  const words = (text.match(/[\p{Script=Latin}\d]+/gu) ?? []).length;
  return Math.max(1, Math.ceil(chinese / 350 + words / 220));
}

export const postUrl = (id: string) => `/posts/${encodeURIComponent(id)}/`;
export const tagUrl = (tag: string) => `/tags/${encodeURIComponent(tag)}/`;
export const pageUrl = (page: number) => page === 1 ? '/' : `/page/${page}/`;
