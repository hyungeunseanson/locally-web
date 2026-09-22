import { defineConfig } from '@playwright/test';

// Actual components with isolated browser/API fixtures; never contacts Supabase.
export default defineConfig({
  testDir: './tests',
  testMatch: ['ui/phone-workspace.spec.ts', 'unit/phone-workspace.spec.ts'],
  workers: 1,
  reporter: 'list',
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
