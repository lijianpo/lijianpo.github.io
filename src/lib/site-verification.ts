import assert from 'node:assert/strict';
import { site } from '../site.config.ts';
import { attr, documentElements } from './html.ts';

export function inspectPage(html: string, path: string) {
  const nodes = documentElements(html);
  const metadata = (name: string) => {
    const node = nodes.find((node) => node.tagName === 'meta' && (attr(node, 'property') === name || attr(node, 'name') === name));
    return node ? attr(node, 'content') : undefined;
  };
  const canonical = nodes.find((node) => node.tagName === 'link' && attr(node, 'rel') === 'canonical');
  assert(canonical, `${path}: 缺少 canonical`);
  const canonicalUrl = attr(canonical, 'href');
  assert(canonicalUrl && new URL(canonicalUrl).origin === site.url, `${path}: canonical 域名错误`);
  if (path !== '/404.html') assert.equal(canonicalUrl, new URL(path, site.url).href, `${path}: canonical 路径错误`);
  assert.equal(metadata('og:url'), canonicalUrl, `${path}: og:url 与 canonical 不一致`);
  assert.equal(attr(nodes.find((node) => node.tagName === 'html')!, 'lang'), site.language);
  const image = metadata('og:image');
  assert(image && new URL(image).origin === site.url, `${path}: 分享图域名错误`);
  assert.equal(metadata('twitter:image'), image, `${path}: Twitter 分享图不一致`);
  assert.equal(metadata('og:image:width'), '1200');
  assert.equal(metadata('og:image:height'), '630');
  assert(metadata('og:image:alt'), `${path}: 分享图缺少替代文字`);
  const ld = nodes.find((node) => node.tagName === 'script' && attr(node, 'type') === 'application/ld+json');
  if (ld) {
    const text = ld.childNodes.map((node) => 'value' in node ? node.value : '').join('');
    const data = JSON.parse(text);
    assert.equal(data.mainEntityOfPage, canonicalUrl);
    assert.equal(data.image, image);
    assert.equal(new URL(data.author.url).origin, site.url);
  }
  return { nodes, image: new URL(image), canonical: canonicalUrl };
}

export function xmlLocations(xml: string) {
  return [...xml.matchAll(/<(?:loc|link|guid)\b[^>]*>([^<]+)<\/(?:loc|link|guid)>/g)]
    .map((match) => match[1].replace(/&amp;/g, '&')).filter((url) => /^https?:/.test(url));
}
