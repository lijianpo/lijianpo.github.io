import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { holdingSchema, postSchema } from './lib/content-schema';
import { imageAwarePosts } from './lib/image-loader';
import { holdingIdFromFile } from './lib/holdings';

const posts = defineCollection({
  loader: imageAwarePosts(),
  schema: postSchema,
});

// Return records shared across articles; the file name is the id used in `performance:`.
const holdings = defineCollection({
  loader: glob({
    pattern: '*.{yaml,yml}', base: './src/data/holdings',
    generateId: ({ entry }) => holdingIdFromFile(entry),
  }),
  schema: holdingSchema,
});

export const collections = { posts, holdings };
