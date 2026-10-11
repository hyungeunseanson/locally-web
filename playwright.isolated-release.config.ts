import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:3100';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/isolated-release.setup.ts',
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  outputDir: 'test-results/isolated-release',
  use: { baseURL, trace: 'on-first-retry', viewport: { width: 1280, height: 720 } },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3100',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
