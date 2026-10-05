import { readdir, readFile } from 'node:fs/promises';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';
import { holdingSchema, postIdPattern, type HoldingData } from './content-schema.ts';

// Node-side reader for checks and tests. Astro's own loader also parses YAML with js-yaml 4.
export const holdingsDirectory = (root: string) => resolve(root, 'src/data/holdings');
const holdingFile = /\.ya?ml$/;

export function holdingIdFromFile(fileName: string): string {
  const id = fileName.replace(holdingFile, '');
  if (!postIdPattern.test(id)) throw new Error(`${fileName}: 持仓文件名请使用英文小写字母、数字和短横线`);
  return id;
}

export function parseHolding(text: string, fileName: string): HoldingData {
  holdingIdFromFile(fileName);
  let data: unknown;
  try { data = yaml.load(text, { filename: fileName }); }
  catch (error) { throw new Error(`${fileName}: YAML 格式错误：${(error as Error).message}`); }
  const result = holdingSchema.safeParse(data);
  if (!result.success) throw new Error(`${fileName}: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('；')}`);
  return result.data;
}

function collect(names: string[], read: (name: string) => string): Map<string, HoldingData> {
  const holdings = new Map<string, HoldingData>();
  for (const name of names.filter((name) => holdingFile.test(name)).sort()) {
    const id = holdingIdFromFile(name);
    if (holdings.has(id)) throw new Error(`${name}: 持仓 ${id} 同时存在 .yaml 和 .yml 文件`);
    holdings.set(id, parseHolding(read(name), name));
  }
  return holdings;
}

const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';

export async function readHoldings(root = process.cwd()): Promise<Map<string, HoldingData>> {
  const directory = holdingsDirectory(root);
  const names = await readdir(directory).catch((error) => { if (missing(error)) return []; throw error; });
  const texts = new Map(await Promise.all(names.map(async (name) => [name, holdingFile.test(name) ? await readFile(resolve(directory, name), 'utf8') : ''] as const)));
  return collect(names, (name) => texts.get(name)!);
}

export function readHoldingsSync(root = process.cwd()): Map<string, HoldingData> {
  const directory = holdingsDirectory(root);
  let names: string[];
  try { names = readdirSync(directory); }
  catch (error) { if (missing(error)) return new Map(); throw error; }
  return collect(names, (name) => readFileSync(resolve(directory, name), 'utf8'));
}
