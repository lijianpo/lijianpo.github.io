import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { site } from './src/site.config.ts';
import blogAssets from './src/integrations/blog-assets.ts';

export default defineConfig({
  site: site.url,
  output: 'static',
  trailingSlash: 'always',
  integrations: [blogAssets(), sitemap({ filter: (page) => !page.endsWith('/404/') && !page.endsWith('/404.html') && !page.endsWith('/search/') })],
  markdown: {
    shikiConfig: { theme: 'github-light', wrap: false },
  },
});
