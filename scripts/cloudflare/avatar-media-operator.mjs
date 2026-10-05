#!/usr/bin/env node
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { AwsClient } from 'aws4fetch';
import { createClient } from '@supabase/supabase-js';
import { AVATAR_BUCKET, AVATAR_MAX_BYTES, SUPABASE_AVATAR_BASE, avatarContentType } from '../../app/utils/avatarMediaContract.mjs';
import { avatarPlanDigest, planAvatarMigration, validateAvatarPlan, executeAvatarPlan, rollbackAvatarPlan } from './avatar-media-migration.mjs';

const PROJECT = 'https://uhinvcydgzqlpnvieyal.supabase.co';
async function loadCore() {
  const built = await build({ entryPoints: ['app/utils/avatarMedia.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
  return import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
}
async function boundedBytes(response) {
  const reader = response.body?.getReader(), chunks = []; let size = 0;
  if (!reader) throw new Error('avatar_empty_response');
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > AVATAR_MAX_BYTES) throw new Error('avatar_read_budget_exceeded');
      chunks.push(value);
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  return new Uint8Array(Buffer.concat(chunks));
}
/** Dedicated avatar S3 adapter: no overwrite, DELETE, COPY or multipart method. */
export function avatarOperatorBinding(env, fetcher = fetch) {
  const endpoint = env.R2_ENDPOINT;
  if (!/^https:\/\/[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(endpoint || '')
    || !env.AVATAR_R2_ACCESS_KEY_ID || !env.AVATAR_R2_SECRET_ACCESS_KEY) throw new Error('avatar_operator_configuration_required');
  const signer = new AwsClient({ accessKeyId: env.AVATAR_R2_ACCESS_KEY_ID, secretAccessKey: env.AVATAR_R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto', retries: 0 });
  const metadata = response => ({ size: Number(response.headers.get('content-length')),
    httpMetadata: { contentType: response.headers.get('content-type'), cacheControl: response.headers.get('cache-control') },
    customMetadata: Object.fromEntries([...response.headers].filter(([key]) => key.startsWith('x-amz-meta-')).map(([key, value]) => [key.slice(11), value])) });
  async function request(method, key, headers = {}, body) {
    if (!/^avatars\/v1\/[a-f0-9]{64}\/[a-f0-9-]{36}\/avatar\.(jpg|png|webp|gif|avif)$/.test(key)) throw new Error('avatar_operator_key_invalid');
    const signed = await signer.sign(endpoint + '/' + AVATAR_BUCKET + '/' + key, { method, headers, body });
    return fetcher(signed, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  }
  return {
    async head(key) {
      const response = await request('HEAD', key);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('avatar_destination_head_failed');
      return metadata(response);
    },
    async get(key) {
      const response = await request('GET', key);
      if (response.status === 404) { await response.body?.cancel(); return null; }
      if (!response.ok) { await response.body?.cancel(); throw new Error('avatar_destination_get_failed'); }
      const bytes = await boundedBytes(response);
      return { ...metadata(response), arrayBuffer: async () => bytes.slice().buffer };
    },
    async put(key, bytes, options) {
      if (options.onlyIf?.etagDoesNotMatch !== '*') throw new Error('avatar_conditional_create_required');
      const headers = { 'If-None-Match': '*', 'Content-Type': options.httpMetadata.contentType, 'Cache-Control': options.httpMetadata.cacheControl,
        'x-amz-content-sha256': options.sha256, ...Object.fromEntries(Object.entries(options.customMetadata).map(([key, value]) => ['x-amz-meta-' + key, value])) };
      const response = await request('PUT', key, headers, bytes);
      await response.body?.cancel();
      if ([409, 412].includes(response.status)) return null; // Caller verifies exact HEAD + GET bytes.
      if (!response.ok) throw new Error('avatar_destination_create_failed');
      return { size: bytes.length };
    },
  };
}
async function privateJson(file, value) {
  await writeFile(file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 }); await chmod(file, 0o600);
}
async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map(value => value.replace(/^--/, '').split('=')));
  const mode = args.mode || 'validate';
  const core = await loadCore();
  if (mode === 'validate') {
    const plan = JSON.parse(await readFile(args.plan, 'utf8'));
    validateAvatarPlan(plan, args['confirm-digest']);
    console.log(JSON.stringify({ mode, planDigest: plan.planDigest, objects: plan.entries.length, sourceWrites: 0, sourceDeletes: 0 })); return;
  }
  if (!['plan', 'prepare', 'apply', 'rollback'].includes(mode) || !args.output) throw new Error('avatar_operator_arguments_required');
  if (mode !== 'plan' && args['approved-digest'] !== args['confirm-digest']) throw new Error('avatar_approved_digest_required');
  // Validate approval/digest before opening any provider client or making reads.
  const plan = mode === 'plan' ? null : validateAvatarPlan(JSON.parse(await readFile(args.plan, 'utf8')), args['confirm-digest']);
  if (process.env.NEXT_PUBLIC_SUPABASE_URL !== PROJECT || !process.env.SUPABASE_SERVICE_ROLE_KEY?.startsWith('sb_secret_')) throw new Error('avatar_operator_configuration_required');
  const registry = createClient(PROJECT, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: (url, init) => fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(30000) }) } });
  const inventory = async () => { const result = await registry.rpc('avatar_migration_inventory'); if (result.error || !result.data) throw new Error('avatar_inventory_read_failed'); return result.data; };
  const readSource = async item => {
    const response = await fetch(SUPABASE_AVATAR_BASE + item.source.key.split('/').map(encodeURIComponent).join('/'), { redirect: 'error', signal: AbortSignal.timeout(30000), cache: 'no-store' });
    let mime;
    try { mime = avatarContentType(response.headers.get('content-type')); } catch { await response.body?.cancel(); throw new Error('avatar_source_mime_failed'); }
    if (!response.ok || mime !== (item.mime ?? avatarContentType(item.source.mime))) {
      await response.body?.cancel(); throw new Error('avatar_source_read_failed');
    }
    return boundedBytes(response);
  };
  if (mode === 'plan') {
    const before = await inventory();
    const result = await planAvatarMigration(before, readSource, core.validateAvatarImage);
    if (avatarPlanDigest(await inventory()) !== result.inventoryDigest) throw new Error('avatar_inventory_drift');
    await privateJson(args.output, result);
    console.log(JSON.stringify({ mode, planDigest: result.planDigest, objects: result.entries.length, sourceBytes: result.entries.reduce((n, row) => n + row.source.size, 0), legacy_unreferenced_retained: result.legacy_unreferenced_retained, sourceWrites: 0, sourceDeletes: 0 })); return;
  }
  const binding = mode === 'rollback' ? null : avatarOperatorBinding(process.env);
  const record = summary => privateJson(args.output, { ...summary, planDigest: plan.planDigest });
  const deps = { inventory, readSource, validateImage: core.validateAvatarImage, record,
    prepare: (item, bytes) => core.prepareManagedAvatar({ registry, binding, actorId: item.ownerId, ownerId: item.ownerId, bytes, contentType: item.mime, assetId: item.assetId, idempotencyKey: item.idempotencyKey }),
    commit: (asset, oldUrl) => core.commitManagedAvatar(registry, asset, oldUrl),
    async verifyCommitted(item) {
      const [profile, asset, reference] = await Promise.all([
        registry.from('profiles').select('avatar_url').eq('id', item.ownerId).single(),
        registry.from('media_assets').select('*').eq('id', item.assetId).single(),
        registry.from('media_asset_references').select('reference_digest').eq('asset_id', item.assetId).eq('parent_type', 'profile_avatar').eq('parent_id', item.ownerId).single(),
      ]);
      if (profile.error || asset.error || reference.error || profile.data.avatar_url !== item.newUrl || asset.data.owner_id !== item.ownerId
        || asset.data.state !== 'committed' || !asset.data.verified_at || asset.data.expected_sha256 !== item.sha256 || Number(asset.data.expected_size) !== item.source.size
        || asset.data.bucket !== item.bucket || asset.data.object_key !== item.key || asset.data.public_url !== item.newUrl
        || reference.data.reference_digest !== (await import('node:crypto')).createHash('sha256').update(item.newUrl).digest('hex')) throw new Error('avatar_commit_verification_failed');
      // Resumed rows also require independently verified destination bytes.
      await core.verifyAvatarR2Bytes(binding, asset.data);
    },
    async rollback(item) {
      const result = await registry.rpc('rollback_profile_avatar', { p_owner_id: item.ownerId, p_asset_id: item.assetId, p_expected_url: item.newUrl, p_old_url: item.oldUrl });
      if (result.error || result.data !== true) throw new Error('avatar_rollback_cas_conflict');
    },
  };
  const result = mode === 'rollback' ? await rollbackAvatarPlan(plan, args['confirm-digest'], deps) : await executeAvatarPlan(plan, args['confirm-digest'], deps, mode);
  await record(result); console.log(JSON.stringify(result));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(JSON.stringify({ status: 'failed', code: error instanceof Error && /^avatar_[a-z_]+$/.test(error.message) ? error.message : 'avatar_operator_failed', sourceWrites: 0, sourceDeletes: 0, remoteDeletes: 0 })); process.exitCode = 1; });
}
