import { defineConfig } from '@playwright/test';

import contractsConfig from './playwright.contracts.config';

export default defineConfig({
  ...contractsConfig,
  globalSetup: undefined,
});
