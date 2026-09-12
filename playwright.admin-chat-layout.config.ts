import { defineConfig } from '@playwright/test';

// Isolated CSS interaction tests: no application server or database access.
export default defineConfig({
  testDir: './tests/ui',
  testMatch: 'admin-chat-layer.spec.ts',
  workers: 1,
  reporter: 'list',
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
