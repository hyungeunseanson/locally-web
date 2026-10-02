import { readFile } from 'node:fs/promises';
import path from 'node:path';
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
  etagMatch: value => value === true,
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
    for (const key of ['kind', 'etagMatch', 'deploymentId', 'versionId', 'etag', 'compatSha256']) {
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
    const base = `https://api.cloudflare.com/client/v4/accounts/${auth.accountId}/workers/scripts/locally-web-opennext-production`;
    const get = async suffix => {
      const response = await fetchImplementation(base + suffix, {
        method: 'GET', redirect: 'error', signal: AbortSignal.timeout(30_000),
        headers: { Authorization: `Bearer ${auth.apiToken}` },
      });
      requireFresh(response.ok);
      const body = await response.json();
      requireFresh(body.success === true);
      return body.result;
    };
    const result = await get('/deployments');
    const deployments = result.deployments ?? result;
    requireFresh(Array.isArray(deployments) && deployments.length > 0
      && deployments.every(d => Number.isFinite(Date.parse(d.created_on))));
    const current = [...deployments].sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0];
    requireFresh(current.id === proof.deploymentId && current.versions?.length === 1
      && current.versions[0].percentage === 100 && current.versions[0].version_id === proof.versionId);
    const version = await get(`/versions/${proof.versionId}`);
    requireFresh(version.id === proof.versionId && version.resources?.script?.etag === proof.etag);
    return proof;
  } catch (error) {
    // Fail closed even on malformed files, transport errors or credential lookup
    // failures. Never attach a cause: it could contain private response content.
    throw new Error(error?.message === LINEAGE_MISMATCH ? LINEAGE_MISMATCH : BASELINE_CHANGED);
  }
}
