import { defineConfig } from '@playwright/test';

// Offline only: no shared global setup, dev server, env loading or live fixtures.
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: [
    'chat-attachments-off.spec.mjs',
    '82-chat-policy-signal-util.spec.ts',
    '139-storage-upload-diagnostic-util.spec.ts',
    '226-host-experience-image-upload-guard.spec.ts',
  ],
  // The remaining case in 226 needs a live Next server and .env.local.
  grepInvert: /WebKit-style partial upload rejects/,
  workers: 1,
  reporter: 'list',
  use: { browserName: 'chromium' },
});
