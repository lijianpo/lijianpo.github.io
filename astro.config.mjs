import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://lijianpo.github.io',
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap({ filter: (page) => !page.endsWith('/404/') && !page.endsWith('/search/') })],
  markdown: {
    shikiConfig: { theme: 'github-light', wrap: false },
  },
});
