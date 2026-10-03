import { createHash } from 'node:crypto';
export const stableId = '11111111-1111-4111-8111-111111111111';
export const candidateId = '22222222-2222-4222-8222-222222222222';
export const deploymentId = '33333333-3333-4333-8333-333333333333';
export const artifactDigest = source => createHash('sha256').update(source).digest('hex');
export function versionProvider(source, changes = {}) {
  const calls = []; let deployments = 0, versions = 0;
  const deployment = { id: deploymentId, created_on: '2026-01-01T00:00:00Z', versions: [{ version_id: stableId, percentage: 100 }] };
  const version = { id: stableId, resources: { script: { etag: 'a'.repeat(64), named_handlers: ['DOQueueHandler', 'DOShardedTagCache'].map(name => ({ name, handlers: ['class'] })) } } };
  const scoped = { id: stableId, main_module: 'worker.js', modules: [{ name: 'worker.js', content_type: 'application/javascript+module', content_base64: Buffer.from(source).toString('base64') }] };
  return { calls, fetch: async (url, options) => {
    calls.push(url);
    if (options.method !== 'GET' || options.redirect !== 'error' || !options.signal) throw new Error('GET-only bounded reads required');
    let result;
    if (url.endsWith('/deployments')) { result = structuredClone(deployment); changes.deployment?.(result, ++deployments); result = { deployments: [result] }; }
    else if (url.endsWith(`/scripts/locally-web-opennext-production/versions/${stableId}`)) { result = structuredClone(version); changes.version?.(result, ++versions); }
    else if (url.endsWith(`/workers/locally-web-opennext-production/versions/${stableId}?include=modules`)) { result = structuredClone(scoped); changes.scoped?.(result); }
    else throw new Error('Unexpected source endpoint: no latest or script-level fallback');
    if (changes.transportError) throw new Error('private-provider-response-do-not-log');
    return Response.json({ success: !changes.apiFailure, result }, { status: changes.httpFailure ? 403 : 200 });
  } };
}
