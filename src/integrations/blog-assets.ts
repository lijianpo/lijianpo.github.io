import type { AstroIntegration } from 'astro';
import type { MarkdownProcessor } from 'astro/markdown';
import { satteri } from '@astrojs/markdown-satteri';
import { parseFragment, serialize, defaultTreeAdapter } from 'parse5';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assetCache, getImageAsset, imageSrcset, proseImageSizes } from '../lib/image-assets.ts';
import { checkContent, imageReferences, readSourcePosts } from '../lib/content-files.ts';
import { getSocialImage } from '../lib/social-images.ts';
import { elements, attr, type HtmlElement } from '../lib/html.ts';

export async function transformImages(html: string, root: string): Promise<string> {
  const tree = parseFragment(html);
  const images = elements(tree).filter((node) => node.tagName === 'img');
  const set = (node: HtmlElement, name: string, value: string | number) => {
    node.attrs = node.attrs.filter((item) => item.name !== name);
    node.attrs.push({ name, value: String(value) });
  };
  for (const [ordinal, node] of images.entries()) {
    const src = attr(node, 'src') ?? '';
    const parent = node.parentNode;
    if (!src.startsWith('/images/') || !parent) continue;
    try {
      const asset = await getImageAsset(src, root);
      set(node, 'width', asset.width);
      set(node, 'height', asset.height);
      set(node, 'decoding', attr(node, 'decoding') ?? 'async');
      set(node, 'loading', attr(node, 'loading') ?? (ordinal === 0 ? 'eager' : 'lazy'));
      if (asset.variants.length && !('tagName' in parent && parent.tagName === 'picture')) {
        const picture = defaultTreeAdapter.createElement('picture', node.namespaceURI, []);
        const source = defaultTreeAdapter.createElement('source', node.namespaceURI, [
          { name: 'type', value: 'image/webp' },
          { name: 'srcset', value: imageSrcset(asset) },
          { name: 'sizes', value: proseImageSizes },
        ]);
        defaultTreeAdapter.insertBefore(parent, picture, node);
        defaultTreeAdapter.detachNode(node);
        defaultTreeAdapter.appendChild(picture, source);
        defaultTreeAdapter.appendChild(picture, node);
      }
    } catch { /* Preflight rejects broken published images; incomplete drafts remain previewable. */ }
  }
  return serialize(tree);
}

function imageProcessor(root: string): MarkdownProcessor {
  const native = satteri();
  return {
    name: 'blog-images',
    options: {},
    async createRenderer(shared) {
      const renderer = await native.createRenderer(shared);
      return { async render(content, options) {
        const result = await renderer.render(content, options);
        return { ...result, code: await transformImages(result.code, root) };
      } };
    }
  };
}

export async function publishAssets(root: string, output: string) {
  const posts = (await readSourcePosts(root)).filter((post) => !post.data.draft);
  const files = new Map<string, string>();
  const defaultCard = await getSocialImage(undefined, root);
  files.set('social-card.png', defaultCard.file);
  files.set(defaultCard.url.slice(1), defaultCard.file);
  for (const post of posts) {
    const card = await getSocialImage(post, root);
    files.set(card.url.slice(1), card.file);
    for (const src of new Set([...imageReferences(post.body), ...(post.data.cover ? [post.data.cover] : [])])) {
      if (!src.startsWith('/images/')) continue;
      const asset = await getImageAsset(src, root);
      for (const variant of asset.variants) files.set(variant.url.slice(1), variant.file);
    }
  }
  for (const [path, source] of files) {
    const target = resolve(output, path);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
  }
  let revision = process.env.GITHUB_SHA ?? 'local';
  if (revision === 'local') {
    try {
      revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()) revision += '-dirty';
    } catch { /* Exported source trees can be built without Git. */ }
  }
  await writeFile(resolve(output, 'build-info.json'), JSON.stringify({ revision }) + '\n');
}

export default function blogAssets(): AstroIntegration {
  let root: string;
  return {
    name: 'blog-assets',
    hooks: {
      'astro:config:setup': async ({ config, command, updateConfig, logger }) => {
        root = fileURLToPath(config.root);
        if (command === 'build') {
          const { warnings } = await checkContent(root);
          for (const warning of warnings) logger.warn(warning);
        }
        updateConfig({ markdown: { processor: imageProcessor(root) } });
      },
      'astro:server:setup': async ({ server }) => {
        const defaultCard = await getSocialImage(undefined, root);
        server.middlewares.use(async (request, response, next) => {
          const path = new URL(request.url ?? '/', 'http://localhost').pathname;
          if (!path.startsWith('/_generated/') && path !== '/social-card.png') return next();
          try {
            const cache = assetCache(root);
            const file = path === '/social-card.png' ? defaultCard.file : resolve(cache, decodeURIComponent(path.slice('/_generated/'.length)));
            if (!file.startsWith(cache + sep)) { response.statusCode = 404; response.end(); return; }
            const bytes = await readFile(file);
            response.setHeader('Content-Type', file.endsWith('.webp') ? 'image/webp' : 'image/png');
            response.setHeader('Cache-Control', 'no-cache');
            response.end(bytes);
          } catch { response.statusCode = 404; response.end(); }
        });
      },
      'astro:build:done': async ({ dir }) => { await publishAssets(root, fileURLToPath(dir)); },
    },
  };
}
