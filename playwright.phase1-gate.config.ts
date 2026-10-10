import { defineConfig } from '@playwright/test';

// Pure contract tests only. No web server, remote DB, global seed, or deployment.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  outputDir: './.phase1-tests/playwright-results',
  use: { baseURL: 'http://127.0.0.1:3000' },
});
