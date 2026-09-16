import assert from 'node:assert/strict';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  digestPayload,
  validateExperienceLocatorMigrationPlan,
} from './experience-media-source-migration.mjs';

const PROJECT_URL = 'https://uhinvcydgzqlpnvieyal.supabase.co';
const LOCATOR_CAS_RPC = 'apply_experience_media_locator_cas';
const MAX_ROWS = 100;
const FIELDS = ['photos', 'image_url', 'itinerary', 'itinerary_i18n'];

function rowState(row) {
  return Object.fromEntries(FIELDS.map((field) => [field, row[field] ?? null]));
}

export function buildLocatorCasRpcBody(change) {
  return {
    p_experience_id: change.experienceId,
    p_before_photos: change.before.photos ?? null,
    p_before_image_url: change.before.image_url ?? null,
    p_before_itinerary: change.before.itinerary ?? null,
    p_before_itinerary_i18n: change.before.itinerary_i18n ?? null,
    p_after_photos: change.after.photos ?? null,
    p_after_image_url: change.after.image_url ?? null,
    p_after_itinerary: change.after.itinerary ?? null,
    p_after_itinerary_i18n: change.after.itinerary_i18n ?? null,
  };
}

export async function applyLocatorPlan({ plan, confirmation, experienceId, loadRows, patchRow, recordProgress = async () => {} }) {
  validateExperienceLocatorMigrationPlan(plan);
  assert.equal(plan.planDigest, confirmation, 'Exact locator plan confirmation is required.');
  assert(plan.changes.length <= MAX_ROWS, 'Locator migration row ceiling exceeded.');
  const selected = experienceId
    ? plan.changes.filter((item) => item.experienceId === String(experienceId))
    : plan.changes;
  assert(selected.length > 0, 'No approved locator changes selected.');
  if (experienceId) assert.equal(selected.length, 1, 'Canary must select exactly one experience.');

  const current = await loadRows(selected.map((item) => item.experienceId));
  assert.equal(current.length, selected.length, 'Current locator row set differs from the approved plan.');
  const byId = new Map(current.map((row) => [String(row.id), row]));
  const pending = [];
  let alreadyExact = 0;
  for (const change of selected) {
    const row = byId.get(change.experienceId);
    assert(row, 'Approved experience row is missing.');
    const currentDigest = digestPayload(rowState(row));
    if (currentDigest === change.nextDigest) {
      alreadyExact += 1;
      continue;
    }
    assert.equal(currentDigest, change.expectedDigest, 'Locator plan is stale before first write.');
    pending.push(change);
  }

  const result = {
    selected: selected.length,
    plannedUpdates: pending.length,
    alreadyExact,
    updated: 0,
    conflicts: 0,
    notFound: 0,
    verified: alreadyExact,
  };
  for (const change of pending) {
    const operation = await patchRow(change);
    if (operation.outcome === 'conflict') {
      result.conflicts += 1;
      await recordProgress(result);
      throw new Error('Optimistic locator update conflict.');
    }
    if (operation.outcome === 'not_found') {
      result.notFound += 1;
      await recordProgress(result);
      throw new Error('Approved experience row was not found during locator update.');
    }
    assert(
      operation.outcome === 'updated' || operation.outcome === 'already_exact',
      'Unknown locator CAS outcome.'
    );
    assert(operation.row, 'Locator CAS success requires a verified row.');
    if (operation.outcome === 'updated') result.updated += 1;
    else result.alreadyExact += 1;
    if (digestPayload(rowState(operation.row)) !== change.nextDigest) {
      await recordProgress(result);
      throw new Error('Locator update verification failed.');
    }
    result.verified += 1;
    await recordProgress(result);
  }
  return result;
}

function parseArgs(argv) {
  const values = Object.fromEntries(argv.filter((value) => value.startsWith('--')).map((value) => {
    const [key, ...rest] = value.slice(2).split('='); return [key, rest.join('=') || 'true'];
  }));
  return {
    plan: values.plan && path.resolve(values.plan),
    confirmation: values['confirm-digest'],
    experienceId: values['experience-id'],
    apply: values.apply === 'true',
    output: path.resolve(values.output || '.tmp/experience-media-locator-result.json'),
  };
}

async function main() {
  const input = parseArgs(process.argv.slice(2));
  if (!input.plan) throw new Error('--plan is required.');
  const plan = JSON.parse(await readFile(input.plan, 'utf8'));
  validateExperienceLocatorMigrationPlan(plan);
  if (!input.apply) {
    console.log(JSON.stringify({ planDigest: plan.planDigest, changes: plan.changes.length, mode: 'read-only' }));
    return;
  }
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (baseUrl !== PROJECT_URL || !serviceRole) throw new Error('Exact Production service-role configuration is required.');
  const headers = { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, 'Content-Type': 'application/json' };
  const loadRows = async (ids) => {
    const query = new URLSearchParams({ select: `id,${FIELDS.join(',')}`, id: `in.(${ids.join(',')})` });
    const response = await fetch(`${baseUrl}/rest/v1/experiences?${query}`, { headers, redirect: 'manual' });
    if (!response.ok) throw new Error(`Locator preflight failed: HTTP ${response.status}.`);
    return response.json();
  };
  const patchRow = async (change) => {
    const response = await fetch(`${baseUrl}/rest/v1/rpc/${LOCATOR_CAS_RPC}`, {
      method: 'POST', headers, redirect: 'manual',
      body: JSON.stringify(buildLocatorCasRpcBody(change)),
    });
    if (!response.ok) throw new Error(`Locator update failed: HTTP ${response.status}.`);
    const outcome = await response.json();
    if (!['updated', 'already_exact'].includes(outcome)) return { outcome };
    const query = new URLSearchParams({ select: `id,${FIELDS.join(',')}`, id: `eq.${change.experienceId}` });
    const verification = await fetch(`${baseUrl}/rest/v1/experiences?${query}`, { headers, redirect: 'manual' });
    if (!verification.ok) throw new Error(`Locator verification failed: HTTP ${verification.status}.`);
    const rows = await verification.json();
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error('Locator verification row is missing.');
    return { outcome, row: rows[0] };
  };
  const recordProgress = (result) => writeFile(input.output, `${JSON.stringify({ ...result, planDigest: plan.planDigest }, null, 2)}\n`, { mode: 0o600 });
  const result = await applyLocatorPlan({ plan, confirmation: input.confirmation, experienceId: input.experienceId, loadRows, patchRow, recordProgress });
  await recordProgress(result);
  await chmod(input.output, 0o600);
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
