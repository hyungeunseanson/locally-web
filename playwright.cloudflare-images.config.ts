import { defineConfig } from '@playwright/test';

import contractsConfig from './playwright.contracts.config';

export default defineConfig({
  ...contractsConfig,
  globalSetup: './tests/e2e/production.guard.ts',
  use: {
    ...contractsConfig.use,
    baseURL: 'https://www.locally-travel.com',
  },
  webServer: undefined,
});
