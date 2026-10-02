import { getCollection } from 'astro:content';
import { visiblePosts } from './posts';

export async function getPosts(includeDrafts = import.meta.env.DEV) {
  return visiblePosts(await getCollection('posts'), includeDrafts);
}
