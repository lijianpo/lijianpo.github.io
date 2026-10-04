import { defineCollection } from 'astro:content';
import { postSchema } from './lib/content-schema';
import { imageAwarePosts } from './lib/image-loader';

const posts = defineCollection({
  loader: imageAwarePosts(),
  schema: postSchema,
});

export const collections = { posts };
