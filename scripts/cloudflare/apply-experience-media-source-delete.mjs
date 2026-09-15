import assert from 'node:assert/strict';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

import { fetchAllExperienceRows, listAllStorageObjects } from './audit-public-experience-media.mjs';
import {
  digestPayload,
  sha256,
  validateExperienceDeletePlan,
} from './experience-media-source-migration.mjs';

const PROJECT_URL = 'https://uhinvcydgzqlpnvieyal.supabase.co';
const MAX_BATCH = 50;

function legacyRefCount(rows, objectName) {
  const encoded = objectName.split('/').map(encodeURIComponent).join('/');
  const locator = `${PROJECT_URL}/storage/v1/object/public/experiences/${encoded}`;
  return (JSON.stringify(rows).match(new RegExp(locator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
}

export async function applyDeletePlan({ plan, confirmation, loadLiveObjects, loadRows, fetchObject, removeBatch, objectExists, recordProgress = async () => {} }) {
  assert.equal(plan.planDigest, confirmation, 'Exact delete plan confirmation is required.');
  const [metadata, rows] = await Promise.all([loadLiveObjects(), loadRows()]);
  const metadataByName = new Map(metadata.map((item) => [item.key || item.name, item]));
  const verified = [];
  for (const planned of plan.objects) {
    assert.equal(legacyRefCount(rows, planned.name), 0, 'Planned object became referenced.');
    const current = metadataByName.get(planned.name);
    assert(current, 'Planned object disappeared before deletion.');
    assert.equal(current.size, planned.size, 'Planned object size drift.');
    const bytes = await fetchObject(planned.name);
    assert.equal(bytes.length, planned.size, 'Planned object received-byte size drift.');
    assert.equal(sha256(bytes), planned.sourceByteSha256, 'Planned object byte SHA drift.');
    verified.push({ ...planned, currentDbRefCount: 0 });
  }
  validateExperienceDeletePlan(plan, verified);

  const result = { planned: plan.objects.length, preverified: verified.length, deleted: 0, absentVerified: 0, failed: 0 };
  for (let index = 0; index < plan.objects.length; index += MAX_BATCH) {
    const names = plan.objects.slice(index, index + MAX_BATCH).map((item) => item.name);
    const removed = await removeBatch(names);
    if (!Array.isArray(removed) || removed.length !== names.length) {
      result.failed += names.length;
      await recordProgress(result);
      throw new Error('Supabase Storage returned a partial deletion batch.');
    }
    result.deleted += names.length;
    for (const name of names) {
      if (await objectExists(name)) {
        await recordProgress(result);
        throw new Error('Deleted object is still present.');
      }
      result.absentVerified += 1;
    }
    await recordProgress(result);
  }
  return result;
}

function parseArgs(argv) {
  const values = Object.fromEntries(argv.filter((value) => value.startsWith('--')).map((value) => {
    const [key, ...rest] = value.slice(2).split('='); return [key, rest.join('=') || 'true'];
  }));
  return { plan: values.plan && path.resolve(values.plan), confirmation: values['confirm-digest'], apply: values.apply === 'true', output: path.resolve(values.output || '.tmp/experience-media-delete-result.json') };
}

async function main() {
  const input = parseArgs(process.argv.slice(2));
  if (!input.plan) throw new Error('--plan is required.');
  const plan = JSON.parse(await readFile(input.plan, 'utf8'));
  if (!input.apply) {
    console.log(JSON.stringify({ planDigest: plan.planDigest, objects: plan.objects?.length, mode: 'read-only' }));
    return;
  }
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (baseUrl !== PROJECT_URL || !serviceRole) throw new Error('Exact Production service-role configuration is required.');
  const headers = { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` };
  const client = createClient(baseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const fetchObject = async (name) => {
    const encoded = name.split('/').map(encodeURIComponent).join('/');
    const response = await fetch(`${baseUrl}/storage/v1/object/authenticated/experiences/${encoded}`, { headers, redirect: 'manual' });
    if (!response.ok) throw new Error(`Storage proof GET failed: HTTP ${response.status}.`);
    return Buffer.from(await response.arrayBuffer());
  };
  const recordProgress = (result) => writeFile(input.output, `${JSON.stringify({ ...result, planDigest: plan.planDigest }, null, 2)}\n`, { mode: 0o600 });
  const result = await applyDeletePlan({
    plan, confirmation: input.confirmation,
    loadLiveObjects: () => listAllStorageObjects(baseUrl, serviceRole),
    loadRows: () => fetchAllExperienceRows(baseUrl, serviceRole),
    fetchObject,
    removeBatch: async (names) => {
      const { data, error } = await client.storage.from('experiences').remove(names);
      if (error) throw new Error(`Storage deletion failed: ${error.statusCode || 'provider-error'}.`);
      return data;
    },
    objectExists: async (name) => {
      const encoded = name.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`${baseUrl}/storage/v1/object/authenticated/experiences/${encoded}`, { headers, redirect: 'manual' });
      if (response.status === 404) return false;
      if (response.ok) return true;
      throw new Error(`Storage post-delete verification failed: HTTP ${response.status}.`);
    },
    recordProgress,
  });
  assert.equal(plan.planDigest, digestPayload({ schema: plan.schema, bucket: plan.bucket, objects: plan.objects }));
  await recordProgress(result);
  await chmod(input.output, 0o600);
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
