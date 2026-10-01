import { defineConfig } from '@playwright/test';

// Actual React/CSS with local API fixtures only; no application or remote DB.
export default defineConfig({
  testDir: './tests/ui',
  testMatch: ['admin-message-monitoring.spec.ts', 'admin-chat-layer.spec.ts'],
  workers: 1,
  reporter: 'list',
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', timezoneId: 'America/Los_Angeles' } },
    { name: 'webkit', use: { browserName: 'webkit', timezoneId: 'America/Los_Angeles' } },
  ],
});
