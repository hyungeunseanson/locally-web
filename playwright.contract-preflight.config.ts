import {defineConfig} from '@playwright/test';
// These specs use injected in-memory dependencies and never start a browser/server.
export default defineConfig({
 testDir:'./tests/e2e',workers:1,reporter:'line',outputDir:'.tmp/contract-preflight',
 testMatch:['239-cloudflare-migration-readiness-contract.spec.ts','242-public-experience-media-key-contract.spec.ts','243-public-experience-media-queue-engine.spec.ts','244-public-experience-media-queue-consumer.spec.ts','245-public-experience-media-queue-producer.spec.ts','246-public-experience-media-producer-integration.spec.ts','236-cloudflare-reconciliation-readonly-safety.spec.ts'],
});
