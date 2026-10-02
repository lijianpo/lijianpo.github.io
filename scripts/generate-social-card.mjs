import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(new URL('../public/social-card.svg', import.meta.url).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: fileURLToPath(new URL('../public/social-card.png', import.meta.url)) });
  console.log('已生成 public/social-card.png (1200 × 630)');
} finally {
  await browser.close();
}
