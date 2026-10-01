import { defineConfig } from '@playwright/test';
import chatConfig from './playwright.chat-regression.config';

// Existing platform contracts run offline against source and mocked delivery.
export default defineConfig({
  ...chatConfig,
  testMatch: [
    '237-cloudflare-functional-canary-contract.spec.ts',
    '239-cloudflare-migration-readiness-contract.spec.ts',
    '247-next-security-runtime-contract.spec.ts',
    '253-admin-support-cloudflare-cron.spec.ts',
    '262-cloudflare-email-provider-contract.spec.ts',
  ],
});
