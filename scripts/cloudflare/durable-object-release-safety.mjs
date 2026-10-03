import { createHash } from 'node:crypto';
import { readActiveVersionArtifact, VERSION_SOURCE } from './active-version-artifact.mjs';

export const DO_MODULES = {
  DOQueueHandler: '.open-next/.build/durable-objects/queue.js',
  DOShardedTagCache: '.open-next/.build/durable-objects/sharded-tag-cache.js',
};
const hash = value => createHash('sha256').update(value).digest('hex');
const SHA256 = /^[a-f0-9]{64}$/;

// Compare complete generated modules, including build IDs and private
// revalidation constants. Removing those constants would hide a DO change.
export function fingerprintDurableObjectArtifact(source) {
  const markers = [...source.matchAll(/^\/\/ (.+)$/gm)];
  const modules = {};
  for (const [name, modulePath] of Object.entries(DO_MODULES)) {
    const found = markers.filter(m => m[1] === modulePath);
    if (found.length !== 1) return null;
    const start = found[0].index;
    const end = markers.find(m => m.index > start)?.index ?? source.length;
    const code = source.slice(start, end);
    if (!code.includes(`var ${name} = class extends DurableObject`)) return null;
    modules[name] = { sha256: hash(code), bytes: Buffer.byteLength(code) };
  }
  const pinSection = source.match(/runtimePins:\s*\{([^}]+)\}/)?.[1] ?? '';
  const declaredPins = {};
  for (const key of ['node', 'next', 'openNextCloudflare', 'wrangler']) {
    const value = pinSection.match(new RegExp(`${key}:\\s*"([0-9.]+)"`))?.[1];
    if (!value) return null;
    declaredPins[key] = value;
  }
  const next = source.match(/globalThis\.nextVersion\s*=\s*"([0-9.]+)"/)?.[1];
  const openNextAws = source.match(/globalThis\.openNextVersion\s*=\s*"([0-9.]+)"/)?.[1];
  if (next !== declaredPins.next || !openNextAws || !markers.length) return null;
  return { modules, preludeSha256: hash(source.slice(0, markers[0].index)),
    dependencies: { ...declaredPins, openNextAws },
    dependencyEvidence: 'bundled_runtime_versions_and_declared_release_pins' };
}

export function compareDurableObjectProof(proof, stableVersionId) {
  const unknown = 'DO_IMPLEMENTATION_UNKNOWN';
  if (!proof || proof.stableVersionId !== stableVersionId
    || !SHA256.test(proof.scriptEtag ?? '') || proof.sourceKind !== VERSION_SOURCE
    || !SHA256.test(proof.artifactSha256 ?? '') || !proof.deploymentId
    || !Array.isArray(proof.namedHandlers)
    || proof.namedHandlers.length !== 2
    || !Object.keys(DO_MODULES).every(name => proof.namedHandlers.some(h => h.name === name && h.handlers?.includes('class')))) return unknown;
  const { stable, candidate } = proof;
  if (!stable || !candidate || !SHA256.test(stable.preludeSha256 ?? '') || !SHA256.test(candidate.preludeSha256 ?? '')) return unknown;
  for (const name of Object.keys(DO_MODULES)) {
    if (![stable, candidate].every(a => SHA256.test(a.modules?.[name]?.sha256 ?? '') && a.modules[name].bytes > 0)) return unknown;
  }
  const keys = ['node', 'next', 'openNextCloudflare', 'wrangler', 'openNextAws'];
  if (!keys.every(k => typeof stable.dependencies?.[k] === 'string' && typeof candidate.dependencies?.[k] === 'string')) return unknown;
  const unchanged = stable.preludeSha256 === candidate.preludeSha256
    && keys.every(k => stable.dependencies[k] === candidate.dependencies[k])
    && Object.keys(DO_MODULES).every(k => stable.modules[k].sha256 === candidate.modules[k].sha256 && stable.modules[k].bytes === candidate.modules[k].bytes);
  if (unchanged) return 'DO_IMPLEMENTATION_UNCHANGED';
  const c = proof.bridgeCompatibility;
  if (!c || c.classification === 'UNKNOWN') return 'UNKNOWN';
  if (c.classification !== 'BRIDGE_COMPATIBLE_BUILD_STATE_ONLY'
    || stable.preludeSha256 !== candidate.preludeSha256
    || !keys.every(k => stable.dependencies[k] === candidate.dependencies[k])
    || !SHA256.test(c.compatSha256 ?? '')
    || c.nextAuthenticationUnchanged !== true || c.workerClientsUnchanged !== true
    || !Object.keys(DO_MODULES).every(k => c.modules?.[k]?.stableSha256 === stable.modules[k].sha256
      && c.modules?.[k]?.candidateSha256 === candidate.modules[k].sha256 && c.modules[k].structuralContractIdentical === true)
    || c.modules.DOShardedTagCache.classification !== 'DO_IMPLEMENTATION_UNCHANGED'
    || c.differences?.length !== 4 || c.differences.some(d => d.class !== 'DOQueueHandler' || d.classification !== 'BUILD_ID_ONLY')
    || !['fourWay', 'generation01', 'generation12', 'rollback'].every(k => c.runtime?.[k] === 'PASS')
    || c.runtime.buildState !== 'BUILD_STATE_RESET_EXPECTED') return 'DO_RUNTIME_CHANGED';
  return 'BRIDGE_COMPATIBLE_BUILD_STATE_ONLY';
}

// Both bridge extraction and DO comparison use the same version-scoped source.
export async function readStableDurableObjectArtifact(options) {
  try {
    const artifact = await readActiveVersionArtifact(options);
    const stable = fingerprintDurableObjectArtifact(artifact.source);
    if (!stable) return null;
    const proof = { stableVersionId: artifact.versionId, deploymentId: artifact.deploymentId,
      sourceKind: artifact.sourceKind, scriptEtag: artifact.etag, artifactSha256: artifact.artifactSha256,
      namedHandlers: artifact.namedHandlers,
      sourceRevision: 'UNKNOWN_NOT_ATTESTED_BY_PROVIDER', stable };
    Object.defineProperty(proof, 'source', { value: artifact.source });
    return proof;
  } catch { return null; }
}
