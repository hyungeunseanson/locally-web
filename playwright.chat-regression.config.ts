import { defineConfig } from '@playwright/test';

// Offline chat regressions only. No app server, auth fixtures, or live database.
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: [
    '82-chat-policy-signal-util.spec.ts',
    '176-inquiry-email-provider-contract.spec.ts',
    '215-inquiry-admin-intervention-contract.spec.ts',
    '223-inquiry-rls-authorization-boundary.spec.ts',
    'chat-attachments-off.spec.mjs',
  ],
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { browserName: 'chromium' },
});
