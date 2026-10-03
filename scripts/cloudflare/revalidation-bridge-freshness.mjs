import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { readActiveVersionArtifact, VERSION_SOURCE } from './active-version-artifact.mjs';
import { resolveCloudflareReadCredentials } from './verify-production-deploy-contract.mjs';

const BASELINE_CHANGED = 'OPENNEXT_REVALIDATION_BRIDGE_BASELINE_CHANGED_BEFORE_DEPLOY';
const LINEAGE_MISMATCH = 'OPENNEXT_REVALIDATION_BRIDGE_LINEAGE_MISMATCH';
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const requireFresh = condition => { if (!condition) throw new Error(BASELINE_CHANGED); };

// An allowlist prevents raw credentials or unrecognized diagnostic fields from
// being accepted as proof. No file contents, provider bodies or causes are logged.
const fields = {
  kind: value => value === 'provider',
  sourceKind: value => value === VERSION_SOURCE,
  artifactSha256: digest,
  deploymentId: uuid,
  versionId: uuid,
  etag: digest,
  compatSha256: digest,
  currentSha256: digest,
  originalQueueSha256: digest,
  patchedQueueSha256: digest,
  length: value => value === 32,
  scannedFiles: value => Number.isSafeInteger(value) && value > 0,
  clientLeakage: value => value === false,
};

export async function assertProductionBridgeProofFresh({
  root = process.cwd(), environment = process.env, credentials,
  fetchImplementation = fetch,
} = {}) {
  try {
    const proof = JSON.parse(await readFile(path.join(root, '.open-next/locally-revalidation-bridge-proof.json'), 'utf8'));
    requireFresh(proof && typeof proof === 'object' && !Array.isArray(proof));
    for (const key of ['kind', 'sourceKind', 'artifactSha256', 'deploymentId', 'versionId', 'etag', 'compatSha256']) {
      requireFresh(fields[key](proof[key]));
    }
    for (const [key, value] of Object.entries(proof)) {
      requireFresh(Object.hasOwn(fields, key) && fields[key](value));
    }
    const policy = JSON.parse(await readFile(path.join(root, 'config/cloudflare/revalidation-bridge.json'), 'utf8'));
    if (!digest(policy?.compatTokenSha256) || policy.compatTokenSha256 !== proof.compatSha256) {
      throw new Error(LINEAGE_MISMATCH);
    }
    requireFresh(policy.workerName === 'locally-web-opennext-production');
    const auth = credentials ?? resolveCloudflareReadCredentials({ environment });
    const active = await readActiveVersionArtifact({ credentials: auth, workerName: policy.workerName,
      stableVersionId: proof.versionId, fetchImplementation });
    requireFresh(active.deploymentId === proof.deploymentId && active.etag === proof.etag
      && active.artifactSha256 === proof.artifactSha256 && active.sourceKind === proof.sourceKind);
    return proof;
  } catch (error) {
    // Fail closed even on malformed files, transport errors or credential lookup
    // failures. Never attach a cause: it could contain private response content.
    throw new Error(error?.message === LINEAGE_MISMATCH ? LINEAGE_MISMATCH : BASELINE_CHANGED);
  }
}
