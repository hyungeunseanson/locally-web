import { defineConfig } from '@playwright/test';

import contractsConfig from './playwright.contracts.config';

export default defineConfig({
  ...contractsConfig,
  globalSetup: undefined,
  use: {
    ...contractsConfig.use,
    baseURL: 'https://www.locally-travel.com',
  },
  webServer: undefined,
});
