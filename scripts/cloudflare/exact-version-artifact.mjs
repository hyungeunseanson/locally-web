import { createHash } from 'node:crypto';

// Cloudflare's documented UUID-scoped modules API identifies the source itself.
// A script-level ETag is not evidence for an immutable version, even if equal.
// No /content/v2 fast path or fallback is permitted.
export async function readExactVersionArtifact({ credentials, workerName, versionId, fetchImplementation = fetch }) {
  try {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(versionId)) throw new Error();
    if (workerName !== 'locally-web-opennext-production') throw new Error();
    const root = `https://api.cloudflare.com/client/v4/accounts/${credentials.accountId}/workers`;
    const script = `${root}/scripts/${workerName}`;
    const json = async url => {
      const r = await fetchImplementation(url, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(30000), headers: { Authorization: `Bearer ${credentials.apiToken}` } });
      if (!r.ok) throw new Error();
      const b = await r.json();
      if (b.success !== true || !b.result) throw new Error();
      return b.result;
    };
    const metadata = await json(`${script}/versions/${versionId}`);
    const scriptEtag = metadata?.resources?.script?.etag;
    if (metadata.id !== versionId || !/^[a-f0-9]{64}$/.test(scriptEtag ?? '') || !Array.isArray(metadata.resources.script.named_handlers)) throw new Error();
    const exact = await json(`${root}/workers/${workerName}/versions/${versionId}?include=modules`);
    if (exact.id !== versionId || typeof exact.main_module !== 'string' || !Array.isArray(exact.modules)) throw new Error();
    if (!exact.modules.every(m => typeof m.name === 'string') || new Set(exact.modules.map(m => m.name)).size !== exact.modules.length) throw new Error();
    const scripts = exact.modules.filter(m => m.content_type === 'application/javascript+module');
    if (scripts.length !== 1 || scripts[0].name !== exact.main_module) throw new Error();
    const encoded = scripts[0].content_base64;
    if (typeof encoded !== 'string' || !encoded.length) throw new Error();
    const bytes = Buffer.from(encoded, 'base64');
    if (bytes.toString('base64') !== encoded) throw new Error();
    const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const after = await json(`${script}/versions/${versionId}`);
    if (after.id !== versionId || JSON.stringify(after.resources) !== JSON.stringify(metadata.resources)) throw new Error();
    const result = { scriptEtag, sourceEvidence: 'EXACT_VERSION_MODULES', sourceSha256: createHash('sha256').update(bytes).digest('hex') };
    Object.defineProperties(result, { source: { value: source }, metadata: { value: metadata } });
    return result;
  } catch { throw new Error('EXACT_VERSION_ARTIFACT_UNAVAILABLE'); }
}
