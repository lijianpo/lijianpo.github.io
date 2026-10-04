import { parse, parseFragment, type DefaultTreeAdapterMap } from 'parse5';

export type HtmlNode = DefaultTreeAdapterMap['node'];
export type HtmlElement = DefaultTreeAdapterMap['element'];
export function elements(node: HtmlNode): HtmlElement[] {
  const found: HtmlElement[] = [];
  if ('tagName' in node) found.push(node);
  if ('childNodes' in node) for (const child of node.childNodes) found.push(...elements(child));
  return found;
}
export const attr = (node: HtmlElement, name: string) => node.attrs.find((item) => item.name === name)?.value;
export const documentElements = (html: string) => elements(parse(html));
export const fragmentElements = (html: string) => elements(parseFragment(html));
