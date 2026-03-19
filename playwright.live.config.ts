import { existsSync, readFileSync } from 'fs';

import { defineConfig, devices } from '@playwright/test';

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;

  const lines = readFileSync(path, 'utf8').split(/\n/);
  for (const line of lines) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (!match) continue;

    const [, key, value] = match;
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile('.env.local');

const liveBaseUrl = process.env.PLAYWRIGHT_LIVE_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL;

if (!liveBaseUrl) {
  throw new Error('Missing PLAYWRIGHT_LIVE_BASE_URL or NEXT_PUBLIC_SITE_URL for live Playwright config.');
}

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global.setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report/live' }],
  ],
  outputDir: 'test-results/live',
  use: {
    baseURL: liveBaseUrl,
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
