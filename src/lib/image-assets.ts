import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import sharp from 'sharp';

export const imageWidths = [320, 640, 960, 1280, 1600];
export const assetCache = (root = process.cwd()) => resolve(root, '.cache/blog-assets');
export const hashContent = (data: string | Buffer) => createHash('sha256').update(data).digest('hex').slice(0, 20);
export interface ImageAsset {
  src: string; width: number; height: number;
  variants: { url: string; width: number; file: string }[];
}

export async function writeCached(file: string, bytes: Buffer | string) {
  try { await access(file); return; } catch { /* Generate this content hash once. */ }
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, bytes);
  await rename(temporary, file);
}

export async function inspectLocalImage(src: string, root = process.cwd(), validate = false) {
  const images = resolve(root, 'public/images');
  const pathname = decodeURIComponent(src.split(/[?#]/, 1)[0]);
  if (!pathname.startsWith('/images/')) throw new Error('请使用 /images/ 开头的本地图片');
  const file = await realpath(resolve(root, 'public', '.' + pathname)).catch(() => { throw new Error('找不到图片文件'); });
  const realImages = await realpath(images);
  if (!file.startsWith(realImages + sep)) throw new Error('图片必须位于 public/images 内');
  const buffer = await readFile(file);
  const metadata = await sharp(buffer, { animated: true }).metadata();
  if (!metadata.width || !metadata.height) throw new Error('无法读取图片尺寸');
  let width = metadata.width;
  let height = metadata.pageHeight ?? metadata.height;
  if ([5, 6, 7, 8].includes(metadata.orientation ?? 1)) [width, height] = [height, width];
  if (validate) await sharp(buffer).resize(1, 1).raw().toBuffer();
  return { buffer, metadata, width, height };
}

const pending = new Map<string, Promise<ImageAsset['variants']>>();
export async function getImageAsset(src: string, root = process.cwd()): Promise<ImageAsset> {
  const { buffer, metadata, width, height } = await inspectLocalImage(src, root);
  if (metadata.format === 'svg' || (metadata.pages ?? 1) > 1) return { src, width, height, variants: [] };
  const key = hashContent(Buffer.concat([Buffer.from(`webp-82-v1-${sharp.versions.sharp}:`), buffer]));
  const cache = assetCache(root);
  const pendingKey = `${cache}:${key}`;
  let work = pending.get(pendingKey);
  if (!work) {
    work = (async () => {
      const widths = [...new Set([...imageWidths.filter((size) => size < width), Math.min(width, 1600)])];
      const variants: ImageAsset['variants'] = [];
      for (const size of widths) {
        const name = `${key}-${size}.webp`;
        const file = resolve(cache, 'images', name);
        try { await access(file); }
        catch {
          const bytes = await sharp(buffer).rotate().resize({ width: size, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
          await writeCached(file, bytes);
        }
        variants.push({ url: `/_generated/images/${name}`, width: size, file });
      }
      return variants;
    })();
    pending.set(pendingKey, work);
    void work.finally(() => pending.delete(pendingKey)).catch(() => {});
  }
  return { src, width, height, variants: await work };
}

export const imageSrcset = (asset: ImageAsset) => asset.variants.map((image) => `${image.url} ${image.width}w`).join(', ');
export const proseImageSizes = '(max-width: 480px) calc(100vw - 40px), (max-width: 700px) calc(100vw - 48px), (max-width: 804px) calc(100vw - 64px), 740px';
