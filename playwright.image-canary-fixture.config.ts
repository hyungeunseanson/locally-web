import {defineConfig} from '@playwright/test';
export default defineConfig({
 outputDir:'test-results/image-canary',
 testDir:'./tests/e2e',testMatch:'226-cloudflare-image-canary.spec.ts',workers:1,timeout:60000,
 use:{baseURL:'http://127.0.0.1:3117',trace:'on',screenshot:'only-on-failure'},
 webServer:{command:'node scripts/cloudflare/run-image-canary-fixture.mjs',url:'http://127.0.0.1:3117',reuseExistingServer:false,timeout:120000},
});
