import { defineConfig } from '@playwright/test';

// Pure server/helper contracts. No dev server, remote auth or cleanup writes.
export default defineConfig({
  testDir: './tests/e2e', globalSetup: './tests/e2e/production.guard.ts',
  fullyParallel: false, workers: 1, reporter: 'line',
  outputDir: '.tmp/financial-p0-contract-results', projects: [{ name: 'chromium' }],
});
