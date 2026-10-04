import { defineConfig, devices } from '@playwright/test';

// Health checks and API assertions must reach the local server directly.
const localBypass = [process.env.NO_PROXY, process.env.no_proxy, 'localhost', '127.0.0.1', '[::1]'].filter(Boolean).join(',');
process.env.NO_PROXY = localBypass;
process.env.no_proxy = localBypass;

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4323', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', testIgnore: '**/*.mobile.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-webkit', testMatch: '**/*.mobile.spec.ts', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'pnpm exec astro preview --host 127.0.0.1 --port 4323 --ignore-lock',
    url: 'http://127.0.0.1:4323',
    reuseExistingServer: !process.env.CI,
  },
});
