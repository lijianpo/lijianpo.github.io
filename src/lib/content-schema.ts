import { z } from 'astro/zod';

export const postIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const recordDate = z.preprocess(
  (value) => value instanceof Date && Number.isFinite(value.valueOf()) ? value.toISOString().slice(0, 10) : value,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '记录日期请使用 YYYY-MM-DD').refine(
    (value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value,
    '记录日期无效',
  ),
);

export const performanceSchema = z.object({
  label: z.string().trim().min(1),
  basis: z.string().trim().min(1),
  points: z.array(z.object({ date: recordDate, returnPercent: z.number() })).min(1),
}).superRefine(({ points }, context) => {
  const dates = new Set<string>();
  points.forEach((point, index) => {
    if (dates.has(point.date)) context.addIssue({ code: 'custom', path: ['points', index, 'date'], message: '同一天只能有一条收益记录' });
    dates.add(point.date);
  });
}).transform((data) => ({ ...data, points: [...data.points].sort((a, b) => a.date.localeCompare(b.date)) }));

export type PerformanceData = z.infer<typeof performanceSchema>;

export const postSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  cover: z.string().trim().regex(/^\/images\/[^?#]+$/, '封面请使用 /images/ 开头的本地图片路径').optional(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  tags: z.array(z.string().trim().min(1)).default([]).transform((tags) => [...new Set(tags)]),
  draft: z.boolean().default(false),
  performance: performanceSchema.optional(),
});

export type PostData = z.infer<typeof postSchema>;
