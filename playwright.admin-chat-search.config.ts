import { defineConfig } from '@playwright/test';
// Actual React/CSS with local I/O fixtures only.
export default defineConfig({
  testDir: './tests/ui', testMatch: ['admin-chat-search.spec.ts'], workers: 1, reporter: 'list',
  projects: ['chromium','webkit'].map(browserName => ({ name: browserName,
    use: { browserName: browserName as 'chromium' | 'webkit' } })),
});
