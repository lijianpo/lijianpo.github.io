import { access, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { site } from '../site.config.ts';
import { assetCache, hashContent, writeCached } from './image-assets.ts';

export interface SocialPost { id: string; data: { title: string; pubDate: Date }; }
export interface SocialImage { url: string; file: string; width: number; height: number; alt: string; }
const escapeMarkup = (text: string) => text.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!);
const fontHashes = new Map<string, { stamp: string; hash: string }>();

async function fontHash(file: string) {
  const { size, mtimeMs } = await stat(file);
  const stamp = `${size}:${mtimeMs}`;
  const cached = fontHashes.get(file);
  if (cached?.stamp === stamp) return cached.hash;
  const hash = hashContent(await readFile(file));
  fontHashes.set(file, { stamp, hash });
  return hash;
}

export async function getSocialImage(post?: SocialPost, root = process.cwd()): Promise<SocialImage> {
  const title = post?.data.title ?? site.tagline;
  const date = post ? new Intl.DateTimeFormat('en-CA', { timeZone: site.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(post.data.pubDate) : '技术 · 记录 · 思考';
  const fontfile = resolve(root, 'assets/fonts/NotoSansCJKsc-Regular.otf');
  const key = hashContent(JSON.stringify({ title, date, site, template: 1, font: await fontHash(fontfile), sharp: sharp.versions.sharp }));
  const name = `${post?.id ?? 'site'}-${key}.png`;
  const file = resolve(assetCache(root), 'social', name);
  // Keep cached fonts and generated output out of the client bundle.
  try { await access(file); }
  catch {
    const renderText = (text: string, size: number, color: string, width: number, height?: number) => sharp({ text: {
      text: `<span foreground="${color}">${escapeMarkup(text)}</span>`,
      font: `Noto Sans CJK SC ${size}`, fontfile, width, ...(height ? { height } : {}), rgba: true, wrap: 'word-char',
    } }).png().toBuffer();
    let heading = await renderText(title, 62, '#202124', 1008);
    if ((await sharp(heading).metadata()).height! > 258) heading = await renderText(title, 62, '#202124', 1008, 258);
    const brand = await renderText(`${site.name}  ·  ${site.tagline}`, 25, '#465366', 950);
    const footer = await renderText(`${date}    ${new URL(site.url).host}`, 22, '#1967d2', 1008);
    const background = Buffer.from('<svg width="1200" height="630"><rect width="1200" height="630" fill="#fff"/><rect x="32" y="32" width="1136" height="566" rx="32" fill="#e8f0fe"/><circle cx="104" cy="106" r="10" fill="#4285f4"/><circle cx="129" cy="106" r="10" fill="#ea4335"/><circle cx="104" cy="131" r="10" fill="#fbbc04"/><circle cx="129" cy="131" r="10" fill="#34a853"/><rect x="96" y="486" width="72" height="5" rx="2" fill="#4285f4"/></svg>');
    const bytes = await sharp(background).composite([
      { input: brand, left: 164, top: 98 }, { input: heading, left: 96, top: 196 }, { input: footer, left: 96, top: 527 },
    ]).png().toBuffer();
    await writeCached(file, bytes);
  }
  return { url: `/_generated/social/${name}`, file, width: 1200, height: 630, alt: `${title} · ${site.name}` };
}
