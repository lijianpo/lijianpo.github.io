import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { holdingSchema, performanceRefSchema, postSchema } from '../src/lib/content-schema';
import { formatReturn, performancePlot, snapshotPerformance, trendOf } from '../src/lib/performance';
import { checkContent, readSourcePosts } from '../src/lib/content-files';
import { parseHolding, readHoldings, readHoldingsSync } from '../src/lib/holdings';
import { fixture, writeHolding, writePost } from './fixtures';

const data = <T extends unknown[]>(points: T) => ({ label: '测试持仓收益率', basis: '测试数据，不代表真实收益', points });

test('收益记录支持 YAML 日期，按日期排序，并拒绝重复日期、非法日期与非数值收益', () => {
  const source = data([
    { date: '2026-10-08', returnPercent: 2 },
    { date: new Date('2026-09-30'), returnPercent: -8.44 },
  ]);
  assert.deepEqual(holdingSchema.parse(source).points.map((point) => point.date), ['2026-09-30', '2026-10-08']);
  assert.equal(source.points[0].date, '2026-10-08');
  for (const points of [
    [],
    [{ date: '2026-02-30', returnPercent: 1 }],
    [{ date: '2026-09-30', returnPercent: Infinity }],
    [{ date: '2026-09-30', returnPercent: '8.44' }],
    [{ date: '2026-09-30', returnPercent: 1 }, { date: new Date('2026-09-30'), returnPercent: 2 }],
  ]) assert.equal(holdingSchema.safeParse(data(points)).success, false);
});

test('文章只引用持仓：支持简写与带 until 的写法，拒绝旧的内联数据和非法文件名', () => {
  assert.deepEqual(performanceRefSchema.parse('haohua'), { holding: 'haohua', until: undefined });
  assert.deepEqual(performanceRefSchema.parse({ holding: 'haohua', until: new Date('2026-09-30') }), { holding: 'haohua', until: '2026-09-30' });
  for (const value of [data([{ date: '2026-09-30', returnPercent: 1 }]), 'HaoHua', '../haohua', { holding: 'haohua', until: '2026-02-30' }, { holding: 'haohua', label: 'x' }]) {
    assert.equal(performanceRefSchema.safeParse(value).success, false, JSON.stringify(value));
  }
  const legacy = postSchema.safeParse({ title: 't', description: 'd', pubDate: '2026-10-03', performance: data([{ date: '2026-09-30', returnPercent: 1 }]) });
  assert.equal(legacy.success, false);
  assert.match(legacy.error!.issues[0].message, /src\/data\/holdings/);
});

test('文章按发布日（站点时区）截取快照，until 可覆盖，没有可显示记录时返回 null', () => {
  const holding = holdingSchema.parse(data([
    { date: '2026-09-30', returnPercent: -8.44 },
    { date: '2026-10-03', returnPercent: -2 },
    { date: '2026-10-04', returnPercent: 1.5 },
  ]));
  const dates = (result: ReturnType<typeof snapshotPerformance>) => result?.points.map((point) => point.date);
  assert.deepEqual(dates(snapshotPerformance(holding, { holding: 'h', until: undefined }, new Date('2026-10-03'))), ['2026-09-30', '2026-10-03']);
  // 2026-10-03T20:00Z is already 10-04 in Asia/Taipei.
  assert.deepEqual(dates(snapshotPerformance(holding, { holding: 'h', until: undefined }, new Date('2026-10-03T20:00:00Z'))), ['2026-09-30', '2026-10-03', '2026-10-04']);
  assert.deepEqual(dates(snapshotPerformance(holding, { holding: 'h', until: '2026-09-30' }, new Date('2026-10-08'))), ['2026-09-30']);
  assert.equal(snapshotPerformance(holding, { holding: 'h', until: undefined }, new Date('2026-09-01')), null);
  assert.equal(holding.points.length, 3);
});

test('只有一个真实记录时显示单点，不凭空添加零收益起点或连线', () => {
  const input = [{ date: '2026-09-30', returnPercent: -8.44 }];
  const plot = performancePlot(input);
  assert.equal(plot.points.length, 1);
  assert.equal(plot.line, null);
  assert.equal(plot.points[0].x, (plot.left + plot.right) / 2);
  assert.equal(plot.points[0].trend, 'loss');
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
  assert.deepEqual(plot.points.map((point) => point.trend), ['loss', 'flat', 'gain']);
  assert.equal(plot.points[1].x - plot.points[0].x, (plot.points[2].x - plot.points[1].x) * 3);
  for (const point of plot.points) assert(point.y > 0 && point.y < plot.bottom);
  const flat = performancePlot([{ date: '2026-01-02', returnPercent: 0 }, { date: '2026-01-05', returnPercent: 0 }]);
  assert(flat.points.every((point) => Number.isFinite(point.y)));
  assert.equal(flat.points[0].y, flat.points[1].y);
  assert.equal(formatReturn(-8.44), '−8.44%');
  assert.equal(formatReturn(3), '+3.00%');
  assert.equal(formatReturn(-0.001), '0.00%');
});

test('涨跌方向与显示一致：四舍五入为 0.00% 的值不着色', () => {
  assert.equal(trendOf(8.44), 'gain');
  assert.equal(trendOf(-8.44), 'loss');
  assert.equal(trendOf(0), 'flat');
  assert.equal(trendOf(-0.001), 'flat');
  assert.equal(trendOf(0.005), 'gain');
});

test('持仓 YAML 与 Astro 一样解析日期，并在出错时指出文件', async (t) => {
  assert.equal(parseHolding('label: a\nbasis: b\npoints:\n  - date: 2026-09-30\n    returnPercent: -8.44\n', 'haohua.yaml').points[0].date, '2026-09-30');
  assert.throws(() => parseHolding('label: [', 'broken.yaml'), /broken\.yaml: YAML 格式错误/);
  assert.throws(() => parseHolding('label: a\nbasis: b\npoints: []\n', 'empty.yaml'), /empty\.yaml: points/);
  assert.throws(() => parseHolding('label: a', 'Bad_Name.yaml'), /Bad_Name\.yaml: 持仓文件名/);
  const root = await fixture(t);
  assert.equal((await readHoldings(root)).size, 0);
  await writeHolding(root, 'haohua', data([{ date: '2026-09-30', returnPercent: -8.44 }]));
  assert.deepEqual([...(await readHoldings(root)).keys()], ['haohua']);
});

test('内容检查解析持仓引用：缺失或无记录时阻止发布，草稿只提示', async (t) => {
  const root = await fixture(t);
  const point = { date: '2026-09-30', returnPercent: -8.44 };
  await writeHolding(root, 'portfolio', data([point]));
  await writePost(root, 'portfolio-note', { performance: 'portfolio' });
  await checkContent(root);
  assert.equal((await readSourcePosts(root))[0].data.performance!.holding, 'portfolio');

  await writePost(root, 'portfolio-note', { performance: 'missing' });
  await assert.rejects(checkContent(root), /portfolio-note\.md: performance: 找不到持仓文件 src\/data\/holdings\/missing\.yaml/);
  await writePost(root, 'portfolio-note', { performance: 'missing', draft: true });
  assert.match((await checkContent(root)).warnings.join('\n'), /找不到持仓文件/);

  await writePost(root, 'portfolio-note', { performance: { holding: 'portfolio', until: '2026-09-01' } });
  await assert.rejects(checkContent(root), /portfolio 在 2026-09-01 及之前没有收益记录/);

  await writePost(root, 'portfolio-note', { performance: 'portfolio' });
  await writeHolding(root, 'portfolio', data([point, point]));
  await assert.rejects(checkContent(root), /portfolio\.yaml:.*同一天/);
});

test('同步与异步读取器使用文件名 ID，支持 yml 并拒绝同名双扩展文件', async (t) => {
  const root = await fixture(t);
  await writeHolding(root, 'portfolio', { ...data([{ date: '2026-09-30', returnPercent: 3 }]), slug: 'ignored-slug' });
  const yamlFile = resolve(root, 'src/data/holdings/portfolio.yaml');
  const ymlFile = resolve(root, 'src/data/holdings/portfolio.yml');
  for (const extension of ['yaml', 'yml']) {
    if (extension === 'yml') await rename(yamlFile, ymlFile);
    const holdings = await readHoldings(root);
    assert.deepEqual([...holdings.keys()], ['portfolio']);
    assert.deepEqual(readHoldingsSync(root), holdings);
    assert.equal(holdings.get('portfolio')!.points[0].returnPercent, 3);
  }
  await copyFile(ymlFile, yamlFile);
  await assert.rejects(readHoldings(root), /同时存在 .yaml 和 .yml/);
  assert.throws(() => readHoldingsSync(root), /同时存在 .yaml 和 .yml/);
});
