import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.CLOUDFLARE_CANARY_BASE_URL;
if (!baseURL) {
  throw new Error('CLOUDFLARE_CANARY_BASE_URL is required for the remote functional canary.');
}

export default defineConfig({
  testDir: './tests/cloudflare-functional',
  globalSetup: './tests/cloudflare-functional/global.setup.ts',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report/cloudflare-functional' }],
  ],
  outputDir: 'test-results/cloudflare-functional',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    viewport: { width: 390, height: 844 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
