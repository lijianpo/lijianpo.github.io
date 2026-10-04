import assert from 'node:assert/strict';
import { test } from 'node:test';
import { performanceSchema } from '../src/lib/content-schema';
import { formatReturn, performancePlot } from '../src/lib/performance';
import { checkContent, readSourcePosts } from '../src/lib/content-files';
import { fixture, writePost } from './fixtures';

const data = <T extends unknown[]>(points: T) => ({ label: '测试持仓收益率', basis: '测试数据，不代表真实收益', points });

test('收益记录支持 YAML 日期，按日期排序，并拒绝重复日期、非法日期与非数值收益', () => {
  const source = data([
    { date: '2026-10-08', returnPercent: 2 },
    { date: new Date('2026-09-30'), returnPercent: -8.44 },
  ]);
  assert.deepEqual(performanceSchema.parse(source).points.map((point) => point.date), ['2026-09-30', '2026-10-08']);
  assert.equal(source.points[0].date, '2026-10-08');
  for (const points of [
    [],
    [{ date: '2026-02-30', returnPercent: 1 }],
    [{ date: '2026-09-30', returnPercent: Infinity }],
    [{ date: '2026-09-30', returnPercent: '8.44' }],
    [{ date: '2026-09-30', returnPercent: 1 }, { date: new Date('2026-09-30'), returnPercent: 2 }],
  ]) assert.equal(performanceSchema.safeParse(data(points)).success, false);
});

test('只有一个真实记录时显示单点，不凭空添加零收益起点或连线', () => {
  const input = [{ date: '2026-09-30', returnPercent: -8.44 }];
  const plot = performancePlot(input);
  assert.equal(plot.points.length, 1);
  assert.equal(plot.line, null);
  assert.equal(plot.points[0].x, (plot.left + plot.right) / 2);
  assert(plot.ticks.some((tick) => tick.value === 0));
  assert(plot.points[0].y > plot.ticks.find((tick) => tick.value === 0)!.y);
});

test('多日曲线保留日期间隔和原始收益，负值、零值和正值都落在坐标范围内', () => {
  const input = [
    { date: '2026-01-06', returnPercent: 3 },
    { date: '2026-01-02', returnPercent: -5 },
    { date: '2026-01-05', returnPercent: 0 },
  ];
  const plot = performancePlot(input);
  assert.equal(plot.line!.split(' ').length, 3);
  assert.deepEqual(plot.points.map((point) => point.returnPercent), [-5, 0, 3]);
  assert.equal(plot.points[1].x - plot.points[0].x, (plot.points[2].x - plot.points[1].x) * 3);
  for (const point of plot.points) assert(point.y > 0 && point.y < plot.bottom);
  const flat = performancePlot([{ date: '2026-01-02', returnPercent: 0 }, { date: '2026-01-05', returnPercent: 0 }]);
  assert(flat.points.every((point) => Number.isFinite(point.y)));
  assert.equal(flat.points[0].y, flat.points[1].y);
  assert.equal(formatReturn(-8.44), '−8.44%');
  assert.equal(formatReturn(3), '+3.00%');
  assert.equal(formatReturn(-0.001), '0.00%');
});

test('Markdown 内容检查读取收益记录并阻止重复日期进入构建', async (t) => {
  const root = await fixture(t);
  const point = { date: '2026-09-30', returnPercent: -8.44 };
  await writePost(root, 'portfolio-note', { performance: data([point]) });
  await checkContent(root);
  assert.equal((await readSourcePosts(root))[0].data.performance!.points[0].returnPercent, -8.44);
  await writePost(root, 'portfolio-note', { performance: data([point, point]) });
  await assert.rejects(checkContent(root), /portfolio-note\.md:.*同一天/);
});
