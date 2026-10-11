import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_LIVE_BASE_URL;
if (!baseURL || new URL(baseURL).protocol !== 'https:') {
  throw new Error('PLAYWRIGHT_LIVE_BASE_URL must be an HTTPS Production origin.');
}

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '271-production-readonly-smoke.spec.ts',
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  outputDir: 'test-results/live-readonly',
  use: { baseURL, trace: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
