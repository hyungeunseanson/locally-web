import { defineConfig } from '@playwright/test';

// Pure local contracts: no web server, credentials, global login or live browser.
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: [
    '229-experience-translation-provider-completeness.spec.ts',
    '230-experience-translation-update-boundary.spec.ts',
    '246-public-experience-media-producer-integration.spec.ts',
    '251-experience-translation-queue.spec.ts',
    'locale-integrity.spec.ts',
  ],
  workers: 1,
  reporter: 'list',
  outputDir: 'test-results/locale-integrity',
});
