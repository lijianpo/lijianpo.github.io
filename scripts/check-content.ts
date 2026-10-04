import { checkContent } from '../src/lib/content-files.ts';

try {
  const { posts, warnings } = await checkContent();
  for (const warning of warnings) console.warn(`草稿提示：${warning}`);
  console.log(`内容检查通过：${posts.length} 篇文章，${posts.filter((post) => post.data.draft).length} 篇草稿。`);
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
