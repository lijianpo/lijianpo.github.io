import { z } from 'astro/zod';

export const postIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const postSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  cover: z.string().trim().regex(/^\/images\/[^?#]+$/, '封面请使用 /images/ 开头的本地图片路径').optional(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  tags: z.array(z.string().trim().min(1)).default([]).transform((tags) => [...new Set(tags)]),
  draft: z.boolean().default(false),
});

export type PostData = z.infer<typeof postSchema>;
