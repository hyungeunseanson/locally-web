import { defineConfig } from '@playwright/test';

import baseConfig from './playwright.config';

const serverMode = process.env.PLAYWRIGHT_SERVER_MODE === 'start' ? 'start' : 'dev';
const webServerCommand =
  serverMode === 'start'
    ? 'npm run start -- --hostname 127.0.0.1'
    : 'npm run dev -- --hostname 127.0.0.1';

export default defineConfig({
  ...baseConfig,
  globalSetup: undefined,
  use: {
    ...baseConfig.use,
    baseURL: 'http://127.0.0.1:3000',
  },
  webServer: {
    command: webServerCommand,
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
