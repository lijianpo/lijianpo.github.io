import { glob, type Loader } from 'astro/loaders';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashContent } from './image-assets.ts';

async function fingerprint(directory: string): Promise<string> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const hashes: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const file = resolve(directory, entry.name);
    hashes.push(entry.name + ':' + (entry.isDirectory() ? await fingerprint(file) : hashContent(await readFile(file))));
  }
  return hashContent(hashes.join('\n'));
}

export function imageAwarePosts(): Loader {
  const markdown = glob({ pattern: '*.md', base: './src/content/posts' });
  return {
    name: 'blog-posts-with-images',
    async load(context) {
      const root = fileURLToPath(context.config.root);
      const directory = resolve(root, 'public/images');
      let imageDigest = await fingerprint(directory);
      // The glob loader normally hashes Markdown only. Image bytes also affect
      // the rendered HTML (dimensions and srcset), in both dev and production.
      await markdown.load({ ...context, generateDigest: (data) => context.generateDigest({ data, imageDigest }) });
      const watcher = context.watcher;
      if (!watcher) return;
      watcher.add(directory);
      let timer: ReturnType<typeof setTimeout>;
      const refresh = (file: string) => {
        if (!file.startsWith(directory + sep)) return;
        clearTimeout(timer);
        timer = setTimeout(async () => {
          try {
            const digest = await fingerprint(directory);
            if (digest === imageDigest) return;
            imageDigest = digest;
            for (const entry of context.store.values()) {
              if (entry.filePath) watcher.emit('change', resolve(root, entry.filePath));
            }
          } catch (error) { context.logger.error(`图片刷新失败：${(error as Error).message}`); }
        }, 120);
      };
      watcher.on('add', refresh).on('change', refresh).on('unlink', refresh);
      watcher.once('close', () => clearTimeout(timer));
    },
  };
}
