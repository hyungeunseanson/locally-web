import { createHash } from 'node:crypto';

// /content/v2 may project the newest uploaded version, not the active version.
// Prefer its ETag only when it matches the requested immutable version. Otherwise
// read modules by exact UUID and recheck that version's metadata/ETag afterwards.
export async function readExactVersionArtifact({ credentials, workerName, versionId, fetchImplementation = fetch }) {
  try {
    if (!/^[a-f0-9-]{36}$/.test(versionId)) throw new Error();
    const root = `https://api.cloudflare.com/client/v4/accounts/${credentials.accountId}/workers`;
    const script = `${root}/scripts/${workerName}`;
    const get = url => fetchImplementation(url, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(30000), headers: { Authorization: `Bearer ${credentials.apiToken}` } });
    const json = async url => { const r=await get(url);const b=await r.json();if(!r.ok||!b.success)throw new Error();return b.result; };
    const metadata = await json(`${script}/versions/${versionId}`);
    const scriptEtag = metadata?.resources?.script?.etag;
    if (metadata?.id !== versionId || !/^[a-f0-9]{64}$/.test(scriptEtag ?? '')) throw new Error();
    const response = await get(`${script}/content/v2`);
    const contentEtag = response.headers.get('etag')?.replace(/^"|"$/g,'');
    let source, sourceEvidence;
    if (response.ok && contentEtag === scriptEtag) {
      const entries = [...(await response.formData()).values()].filter(v=>typeof v!=='string'&&v.name.endsWith('.js'));
      if(entries.length!==1)throw new Error();
      source=await entries[0].text();sourceEvidence='MATCHING_CONTENT_ETAG';
    } else {
      await response.arrayBuffer();
      const exact=await json(`${root}/workers/${workerName}/versions/${versionId}?include=modules`);
      if(exact.id!==versionId || !Array.isArray(exact.modules))throw new Error();
      const scripts=exact.modules.filter(m=>m.name===exact.main_module && m.content_type==='application/javascript+module');
      if(scripts.length!==1 || typeof scripts[0].content_base64!=='string')throw new Error();
      source=Buffer.from(scripts[0].content_base64,'base64').toString('utf8');
      const after=await json(`${script}/versions/${versionId}`);
      if(JSON.stringify(after.resources)!==JSON.stringify(metadata.resources)||after.id!==versionId)throw new Error();
      sourceEvidence='EXACT_VERSION_MODULES';
    }
    return { metadata, source, scriptEtag, contentEtag:sourceEvidence==='MATCHING_CONTENT_ETAG'?contentEtag:null,
      sourceEvidence, sourceSha256:createHash('sha256').update(source).digest('hex') };
  } catch { throw new Error('EXACT_VERSION_ARTIFACT_UNAVAILABLE'); }
}
