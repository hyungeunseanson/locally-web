import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { AVATAR_BUCKET } from '../../app/utils/avatarMediaContract.mjs';

/** Offline-only overlay on the existing verified Production release config. */
export function prepareAvatarCutoverConfig(base, enabled = 'false') {
  assert(['false','true'].includes(enabled), 'avatar_flag_invalid');
  const result = structuredClone(base), production = result.env?.production;
  assert(production?.name === 'locally-web-opennext-production' && result.keep_vars === true, 'avatar_config_baseline_required');
  const bindings = production.r2_buckets ?? [];
  const existing = bindings.filter(binding => binding.binding === 'PUBLIC_AVATAR_R2' || binding.bucket_name === AVATAR_BUCKET);
  assert(existing.length <= 1 && existing.every(binding => binding.binding === 'PUBLIC_AVATAR_R2' && binding.bucket_name === AVATAR_BUCKET), 'avatar_binding_collision');
  production.r2_buckets = existing.length ? bindings : [...bindings, {binding:'PUBLIC_AVATAR_R2',bucket_name:AVATAR_BUCKET}];
  production.vars = {...production.vars, AVATAR_R2_SOURCE_ENABLED: enabled};
  // No schema/secret/Queue/Cron/service/runtime/route modification is possible.
  const normalized = structuredClone(result);
  normalized.env.production.r2_buckets = structuredClone(base.env.production.r2_buckets);
  normalized.env.production.vars = structuredClone(base.env.production.vars);
  assert.deepEqual(normalized, base, 'avatar_unrelated_configuration_change');
  return result;
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const args=Object.fromEntries(process.argv.slice(2).map(arg=>arg.replace(/^--/,'').split('=')));
  if(!args.input || !args.output) throw new Error('avatar_input_output_required');
  const config=prepareAvatarCutoverConfig(JSON.parse(await readFile(args.input,'utf8')),args.enabled??'false');
  await writeFile(args.output,JSON.stringify(config,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({mode:'offline-config-only',bucket:AVATAR_BUCKET,binding:'PUBLIC_AVATAR_R2',flag:args.enabled??'false',providerWrites:0}));
}
