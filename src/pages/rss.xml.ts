import type { APIRoute } from 'astro';
import rss from '@astrojs/rss';
import { getPosts } from '../lib/blog';
import { postUrl } from '../lib/posts';
import { site } from '../site.config';

export const GET: APIRoute = async (context) => rss({
  title: `${site.name} · ${site.tagline}`,
  description: site.description,
  site: context.site!,
  items: (await getPosts(false)).map((post) => ({
    title: post.data.title,
    description: post.data.description,
    pubDate: post.data.pubDate,
    link: postUrl(post.id),
    categories: post.data.tags,
  })),
  customData: '<language>zh-CN</language>',
});
