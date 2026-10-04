import { parseArgs } from 'node:util';
import { relative } from 'node:path';
import { createPost } from '../src/lib/content-files.ts';

try {
  const { values, positionals } = parseArgs({ options: { title: { type: 'string' } }, allowPositionals: true });
  if (positionals.length !== 1) throw new Error('用法：pnpm new:post <slug> --title "文章标题"');
  const path = await createPost(positionals[0], values.title ?? '');
  console.log(`已创建草稿：${relative(process.cwd(), path)}\n补充摘要与正文后，用 pnpm dev 预览。准备发布时将 draft 改为 false。`);
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
