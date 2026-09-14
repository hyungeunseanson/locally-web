#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildBoundedRecoveryPlan,
  buildRecoveryInventory,
  createRecoveryBudgetState,
  verifyRecoverySources,
} from './recover-public-experience-media.mjs';
import { buildSourceScopes, normalizeSupabaseExperienceObjectKey } from './audit-public-experience-media.mjs';
import { parseCardManifest } from './reconcile-public-experience-images.mjs';
import { stableJson } from './plan-public-experience-media-repair.mjs';

const outputDirectory = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Fixture output directory is required.');

const baseUrl = 'https://uhinvcydgzqlpnvieyal.supabase.co';
const sourceUrl = `${baseUrl}/storage/v1/object/public/experiences/experience/11111111-1111-4111-8111-111111111111/hero/current.jpg`;
const sourceKey = normalizeSupabaseExperienceObjectKey(sourceUrl);
const sourceBytes = Buffer.from('source-bytes');
const storage = [{ key: sourceKey, size: sourceBytes.length, contentType: 'image/jpeg', etag: 'fixture-etag' }];
const source = buildSourceScopes(
  [{ id: 77, status: 'active', is_active: true, photos: [sourceUrl], itinerary: [], image_url: null }],
  storage,
  baseUrl,
);
const identity = createHash('sha256').update(sourceUrl).digest('hex').slice(0, 12);
const cards = parseCardManifest(`export const PUBLIC_EXPERIENCE_CARD_IMAGES = {
  "77": {
    originUrl: "${sourceUrl}",
    smallKey: "cards/experience-77-primary-${identity}-w384-q65.webp",
    largeKey: "cards/experience-77-primary-${identity}-w640-q65.webp",
  },
} as const;`);
const inventory = buildRecoveryInventory(source, storage, cards, {});
const inspection = {
  r2StateDigest: 'a'.repeat(64),
  derivatives: inventory.sources.flatMap((item) => item.derivatives.map((derivative) => ({ key: derivative.key, classification: 'missing' }))),
  originalsBySourceKeySha256: {},
};

await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
const plan = await buildBoundedRecoveryPlan({
  inventory,
  r2Inspection: inspection,
  budget: { maxSourceDownloads: 1, maxSourceBytes: 1024, maxOriginalCreates: 1, maxDerivativeCreates: 5, maxTransforms: 5 },
  outputDirectory,
  fetchSource: async (_source, { onBytes }) => {
    onBytes(sourceBytes.length);
    return { bytes: sourceBytes, contentType: 'image/jpeg', etag: 'fixture-etag' };
  },
  transform: async ({ specification }) => Buffer.from(`fixture-webp-${specification.role}-${specification.width}`),
});
await writeFile(path.join(outputDirectory, '.recovery-plan.json'), stableJson(plan), { mode: 0o600 });
const budgetState = createRecoveryBudgetState(plan);
await verifyRecoverySources({
  inventory,
  plan,
  phase: 'preApply',
  budgetState,
  fetchSource: async (_source, { onBytes }) => {
    onBytes(sourceBytes.length);
    return { bytes: sourceBytes, contentType: 'image/jpeg', etag: 'fixture-etag' };
  },
});
await writeFile(path.join(outputDirectory, '.recovery-budget.json'), stableJson(budgetState), { mode: 0o600 });
process.stdout.write(`${stableJson({ planDigest: plan.planDigest, originalCount: plan.execution.originals.length, derivativeCount: plan.execution.derivatives.length })}`);
