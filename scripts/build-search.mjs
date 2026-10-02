import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const entries = await readdir('dist/posts', { withFileTypes: true }).catch((error) => {
  if (error.code === 'ENOENT') return [];
  throw error;
});

if (entries.some((entry) => entry.isDirectory())) {
  const result = spawnSync('pagefind', ['--site', 'dist', '--root-selector', '[data-pagefind-body]'], {
    stdio: 'inherit', shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} else {
  console.log('没有已发布文章，跳过搜索索引；搜索页将显示空状态。');
}
