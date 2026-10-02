export {};

interface SearchData { url: string; excerpt: string; meta: { title?: string }; }
interface SearchResult { data: () => Promise<SearchData>; }
interface SearchIndex { search: (query: string) => Promise<{ results: SearchResult[] }>; }
const form = document.querySelector<HTMLFormElement>('.search-form');
const input = document.querySelector<HTMLInputElement>('#search-input');
const status = document.querySelector<HTMLElement>('#search-status');
const container = document.querySelector<HTMLElement>('#search-results');
const start = document.querySelector<HTMLElement>('#search-start');
const more = document.querySelector<HTMLButtonElement>('#search-more');

if (form && input && status && container && start && more) {
  let index: Promise<SearchIndex> | undefined;
  let sequence = 0;
  let timer: ReturnType<typeof setTimeout>;
  let results: SearchResult[] = [];
  let shown = 0;
  let importAttempt = 0;
  const searchBundle = '/pagefind/pagefind.js';
  const getIndex = (): Promise<SearchIndex> => {
    const url = importAttempt ? `${searchBundle}?retry=${importAttempt}` : searchBundle;
    return index ??= import(/* @vite-ignore */ url).catch((error) => {
      index = undefined;
      importAttempt++;
      throw error;
    });
  };
  // Pagefind excerpts contain <mark>. Recreate just that markup; never insert arbitrary HTML.
  const excerpt = (html: string) => {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const fragment = document.createDocumentFragment();
    const append = (node: Node, parent: Node) => {
      if (node.nodeType === Node.TEXT_NODE) parent.appendChild(document.createTextNode(node.textContent ?? ''));
      else if (node instanceof HTMLElement && node.tagName === 'MARK') {
        const mark = document.createElement('mark');
        mark.textContent = node.textContent;
        parent.appendChild(mark);
      } else node.childNodes.forEach((child) => append(child, parent));
    };
    parsed.body.childNodes.forEach((child) => append(child, fragment));
    return fragment;
  };
  const appendResults = async (request: number) => {
    const next = await Promise.all(results.slice(shown, shown + 10).map((result) => result.data()));
    if (request !== sequence) return;
    for (const data of next) {
      const article = document.createElement('article');
      article.className = 'search-result';
      const title = document.createElement('h2');
      const link = document.createElement('a');
      const url = new URL(data.url, window.location.origin);
      if (url.origin !== window.location.origin) continue;
      link.href = url.pathname + url.hash;
      link.textContent = data.meta.title ?? '未命名文章';
      title.append(link);
      const description = document.createElement('p');
      description.append(excerpt(data.excerpt));
      article.append(title, description);
      container.append(article);
    }
    shown += next.length;
    more.hidden = shown >= results.length;
  };
  const search = async () => {
    const query = input.value.trim();
    const request = ++sequence;
    const url = new URL(window.location.href);
    if (query) url.searchParams.set('q', query);
    else url.searchParams.delete('q');
    window.history.replaceState({}, '', url);
    container.replaceChildren();
    more.hidden = true;
    start.hidden = Boolean(query);
    results = [];
    shown = 0;
    if (!query) { status.textContent = '输入关键词，寻找一段记录。'; return; }
    if (form.dataset.empty === 'true') {
      status.textContent = '目前还没有已发布文章，可以稍后再来。';
      return;
    }
    if (form.dataset.dev === 'true') {
      status.textContent = '本地开发模式未生成搜索索引。运行 pnpm build 和 pnpm preview 后可体验完整搜索。';
      return;
    }
    status.textContent = '正在寻找相关的文章…';
    try {
      const pagefind = await getIndex();
      if (request !== sequence) return;
      const response = await pagefind.search(query);
      if (request !== sequence) return;
      results = response.results;
      await appendResults(request);
      if (request !== sequence) return;
      status.textContent = results.length ? `找到 ${results.length} 篇相关文章` : `没有找到「${query}」，试试更短的关键词。`;
    } catch {
      if (request !== sequence) return;
      index = undefined;
      importAttempt++;
      status.textContent = '搜索暂时无法加载，请重新搜索。也可以通过归档浏览文章。';
    }
  };
  form.addEventListener('submit', (event) => { event.preventDefault(); clearTimeout(timer); void search(); });
  input.addEventListener('input', (event) => {
    clearTimeout(timer);
    sequence++;
    if (!(event as InputEvent).isComposing) timer = setTimeout(search, 180);
  });
  input.addEventListener('compositionend', () => { clearTimeout(timer); timer = setTimeout(search, 180); });
  more.addEventListener('click', async () => {
    const request = sequence;
    more.disabled = true;
    try { await appendResults(request); }
    catch { if (request === sequence) status.textContent = '更多结果暂时无法加载，请重试。'; }
    finally { more.disabled = false; }
  });
  input.value = new URLSearchParams(window.location.search).get('q') ?? '';
  if (input.value) void search();
  else input.focus({ preventScroll: true });
}
