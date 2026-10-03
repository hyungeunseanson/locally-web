import { defineConfig } from '@playwright/test';

// Actual React/CSS and local API fixtures; no remote application or database.
export default defineConfig({
  testDir: './tests/ui', testMatch: ['admin-chat-operations.spec.ts'], workers: 1, reporter: 'list',
  projects: ['chromium', 'webkit'].map(browserName => ({ name: browserName,
    use: { browserName: browserName as 'chromium' | 'webkit', timezoneId: 'America/Los_Angeles' } })),
});
