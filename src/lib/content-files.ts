import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import { site } from '../site.config.ts';
import { postIdPattern, postSchema, type PostData } from './content-schema.ts';
import { attr, fragmentElements } from './html.ts';
import { inspectLocalImage } from './image-assets.ts';

export interface SourcePost { id: string; file: string; body: string; data: PostData; }

export function imageReferences(markdown: string): string[] {
  const tree = unified().use(remarkParse).parse(markdown);
  const definitions = new Map<string, string>();
  const urls = new Set<string>();
  visit(tree, 'definition', (node) => { definitions.set(node.identifier.toLowerCase(), node.url); });
  visit(tree, (node) => {
    if (node.type === 'image') urls.add(node.url);
    if (node.type === 'imageReference') {
      const url = definitions.get(node.identifier.toLowerCase());
      if (url) urls.add(url);
    }
    if (node.type === 'html') for (const element of fragmentElements(node.value)) {
      if (element.tagName === 'img' && attr(element, 'src')) urls.add(attr(element, 'src')!);
    }
  });
  return [...urls];
}

export async function readSourcePosts(root = process.cwd()): Promise<SourcePost[]> {
  const directory = resolve(root, 'src/content/posts');
  const posts: SourcePost[] = [];
  for (const name of (await readdir(directory)).filter((name) => name.endsWith('.md')).sort()) {
    const file = resolve(directory, name);
    const id = name.slice(0, -3);
    if (!postIdPattern.test(id)) throw new Error(`${name}: 文件名请使用英文小写字母、数字和短横线`);
    const { data, content } = matter(await readFile(file, 'utf8'));
    if (data.slug !== undefined) throw new Error(`${name}: URL 使用文件名，不设置 slug`);
    const result = postSchema.safeParse(data);
    if (!result.success) throw new Error(`${name}: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('；')}`);
    posts.push({ id, file, body: content, data: result.data });
  }
  return posts;
}

export async function checkContent(root = process.cwd()) {
  const posts = await readSourcePosts(root);
  const warnings: string[] = [];
  const errors: string[] = [];
  const checked = new Map<string, Promise<unknown>>();
  for (const post of posts) {
    const urls = new Set([...imageReferences(post.body), ...(post.data.cover ? [post.data.cover] : [])]);
    for (const url of urls) {
      if (!url.startsWith('/images/')) continue;
      let check = checked.get(url);
      if (!check) { check = inspectLocalImage(url, root, true); checked.set(url, check); }
      try { await check; }
      catch (error) {
        (post.data.draft ? warnings : errors).push(`${post.id}.md: ${url}: ${(error as Error).message}`);
      }
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return { posts, warnings };
}

export async function createPost(slug: string, title: string, root = process.cwd(), now = new Date()) {
  if (!postIdPattern.test(slug)) throw new Error('文件名请使用英文小写字母、数字和短横线');
  if (!title.trim()) throw new Error('请使用 --title 提供文章标题');
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: site.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const directory = resolve(root, 'src/content/posts');
  await mkdir(directory, { recursive: true });
  const file = resolve(directory, `${slug}.md`);
  const content = matter.stringify('\n在这里开始记录。\n\n## 一个小标题\n\n写下你的想法。\n', {
    title: title.trim(), description: '请在发布前填写文章摘要。', pubDate: date, tags: [], draft: true,
  });
  try { await writeFile(file, content, { flag: 'wx' }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error(`${slug}.md 已存在，请使用其他文件名`);
    throw error;
  }
  return file;
}
