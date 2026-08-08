import { defineConfig } from '@playwright/test';

import baseConfig from './playwright.config';

const port = 3101;
const baseURL = `http://127.0.0.1:${port}`;
const adsenseTestEnv = {
  NEXT_PUBLIC_ADSENSE_ENABLED: 'true',
  NEXT_PUBLIC_ADSENSE_CLIENT_ID: 'ca-pub-1234567890',
  NEXT_PUBLIC_ADSENSE_DESKTOP_FOOTER_SLOT: '2222222222',
  NEXT_PUBLIC_ADSENSE_DESKTOP_RIGHT_RAIL_SLOT: '3333333333',
};

Object.assign(process.env, adsenseTestEnv);

export default defineConfig({
  ...baseConfig,
  use: {
    ...baseConfig.use,
    baseURL,
    storageState: {
      cookies: [],
      origins: [
        {
          origin: baseURL,
          localStorage: [
            {
              name: 'locally_legacy_popup_closed_at',
              value: String(Date.now()),
            },
          ],
        },
      ],
    },
  },
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      ...adsenseTestEnv,
    },
  },
});
