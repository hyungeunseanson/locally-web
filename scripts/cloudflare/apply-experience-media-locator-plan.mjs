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
const MAX_ROWS = 100;
const FIELDS = ['photos', 'image_url', 'itinerary', 'itinerary_i18n'];

function rowState(row) {
  return Object.fromEntries(FIELDS.map((field) => [field, row[field] ?? null]));
}

function filterValue(value) {
  return value === null ? 'is.null' : `eq.${JSON.stringify(value)}`;
}

export function buildOptimisticPatchUrl(baseUrl, change) {
  const query = new URLSearchParams({ id: `eq.${change.experienceId}` });
  for (const field of FIELDS) query.set(field, filterValue(change.before[field] ?? null));
  return `${baseUrl}/rest/v1/experiences?${query}`;
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
  for (const change of selected) {
    const row = byId.get(change.experienceId);
    assert(row, 'Approved experience row is missing.');
    assert.equal(digestPayload(rowState(row)), change.expectedDigest, 'Locator plan is stale before first write.');
  }

  const result = { selected: selected.length, updated: 0, conflicts: 0, verified: 0 };
  for (const change of selected) {
    const updated = await patchRow(change);
    if (!updated) {
      result.conflicts += 1;
      await recordProgress(result);
      throw new Error('Optimistic locator update conflict.');
    }
    result.updated += 1;
    if (digestPayload(rowState(updated)) !== change.nextDigest) {
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
    const response = await fetch(buildOptimisticPatchUrl(baseUrl, change), {
      method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' }, redirect: 'manual',
      body: JSON.stringify(change.after),
    });
    if (!response.ok) throw new Error(`Locator update failed: HTTP ${response.status}.`);
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length !== 1) return null;
    return rows[0];
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
