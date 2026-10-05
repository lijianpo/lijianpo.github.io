import { z } from 'astro/zod';

export const postIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const recordDate = z.preprocess(
  (value) => value instanceof Date && Number.isFinite(value.valueOf()) ? value.toISOString().slice(0, 10) : value,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '记录日期请使用 YYYY-MM-DD').refine(
    (value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value,
    '记录日期无效',
  ),
);

// One file per position under src/data/holdings/; daily reviews append points here.
export const holdingSchema = z.object({
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

export type HoldingData = z.infer<typeof holdingSchema>;

const holdingId = z.string({ error: 'performance 请填写 src/data/holdings/ 下的持仓文件名，例如 performance: haohua' })
  .trim().regex(postIdPattern, '持仓文件名请使用英文小写字母、数字和短横线');

// Articles reference a holding; the chart shows records up to `until` (default: the article's pubDate).
export const performanceRefSchema = z.union([
  holdingId.transform((holding) => ({ holding, until: undefined as string | undefined })),
  z.strictObject({ holding: holdingId, until: recordDate.optional() }),
], { error: 'performance 请写成 performance: haohua 或 { holding: haohua, until: YYYY-MM-DD }；收益数据放在 src/data/holdings/haohua.yaml' });

export type PerformanceRef = z.infer<typeof performanceRefSchema>;

export const postSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  cover: z.string().trim().regex(/^\/images\/[^?#]+$/, '封面请使用 /images/ 开头的本地图片路径').optional(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  tags: z.array(z.string().trim().min(1)).default([]).transform((tags) => [...new Set(tags)]),
  draft: z.boolean().default(false),
  performance: performanceRefSchema.optional(),
});

export type PostData = z.infer<typeof postSchema>;
