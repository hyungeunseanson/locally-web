import { readExactVersionArtifact } from './exact-version-artifact.mjs';

export const VERSION_SOURCE = 'workers-version-modules';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const ERROR = 'ACTIVE_VERSION_ARTIFACT_PROVENANCE_FAILED';
const check = condition => { if (!condition) throw new Error(ERROR); };

// The documented version API includes modules for an exact UUID. Script-level
// /content/v2 is mutable and is deliberately never used, even as a fallback.
// Source stays in memory; serializable evidence contains identities/digests only.
export async function readActiveVersionArtifact({ credentials, workerName, stableVersionId, fetchImplementation = fetch }) {
  try {
    check(workerName === 'locally-web-opennext-production');
    check(stableVersionId === undefined || UUID.test(stableVersionId));
    const base = `https://api.cloudflare.com/client/v4/accounts/${credentials.accountId}/workers`;
    const script = `/scripts/${workerName}`;
    const get = async suffix => {
      const response = await fetchImplementation(base + suffix, {
        method: 'GET', redirect: 'error', signal: AbortSignal.timeout(30_000),
        headers: { Authorization: `Bearer ${credentials.apiToken}` },
      });
      check(response.ok);
      const body = await response.json();
      check(body.success === true && body.result);
      return body.result;
    };
    const deployment = async () => {
      const result = await get(`${script}/deployments`);
      const rows = result.deployments ?? result;
      check(Array.isArray(rows) && rows.length > 0 && rows.every(d => Number.isFinite(Date.parse(d.created_on))));
      const d = [...rows].sort((a,b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0];
      check(UUID.test(d.id) && Array.isArray(d.versions) && d.versions.length >= 1 && d.versions.length <= 2);
      const versions = d.versions.map(v => ({ id: v?.version_id, percentage: v?.percentage }));
      check(versions.every(v => UUID.test(v.id) && (v.percentage === 100 || v.percentage === 0))
        && new Set(versions.map(v => v.id)).size === versions.length
        && versions.filter(v => v.percentage === 100).length === 1);
      versions.sort((a,b) => a.id.localeCompare(b.id));
      return { deploymentId: d.id, versionId: versions.find(v => v.percentage === 100).id, deploymentVersions: versions };
    };
    const before = await deployment();
    check(stableVersionId === undefined || stableVersionId === before.versionId);
    const artifact = await readExactVersionArtifact({ credentials, workerName, versionId: before.versionId, fetchImplementation });
    check(JSON.stringify(before) === JSON.stringify(await deployment()));
    const result = { sourceKind: VERSION_SOURCE, ...before, etag: artifact.scriptEtag,
      namedHandlers: artifact.metadata.resources.script.named_handlers, artifactSha256: artifact.sourceSha256 };
    Object.defineProperty(result, 'source', { value: artifact.source });
    return result;
  } catch {
    // Provider bodies, parser errors and credentials must not escape diagnostics.
    throw new Error(ERROR);
  }
}
