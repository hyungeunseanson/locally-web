import { defineConfig } from '@playwright/test';

import contractsConfig from './playwright.contracts.config';

const productionReadonlyImageSpecs = [
  '**/226-cloudflare-image-canary.spec.ts',
  '**/227-cloudflare-public-card-images.spec.ts',
  '**/228-cloudflare-public-detail-images.spec.ts',
  '**/233-cloudflare-public-host-profile-images.spec.ts',
  '**/234-cloudflare-public-host-profile-purge-boundary.spec.ts',
];

export default defineConfig({
  ...contractsConfig,
  globalSetup: './tests/e2e/production.guard.ts',
  testMatch: productionReadonlyImageSpecs,
  use: {
    ...contractsConfig.use,
    baseURL: 'https://www.locally-travel.com',
  },
  webServer: undefined,
});
