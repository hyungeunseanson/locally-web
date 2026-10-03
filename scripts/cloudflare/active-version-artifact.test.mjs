import assert from 'node:assert/strict';
import test from 'node:test';
import { readActiveVersionArtifact, VERSION_SOURCE } from './active-version-artifact.mjs';
import { versionProvider, stableId, candidateId, artifactDigest } from './active-version-artifact.fixture.mjs';
const source = 'export default { fetch() { return new Response("stable"); } };';
import { captureStableVersion } from './candidate-release-contract.mjs';
const read = (p, id = stableId) => readActiveVersionArtifact({ credentials: { accountId: 'fixture', apiToken: 'private-token' }, workerName: 'locally-web-opennext-production', stableVersionId: id, fetchImplementation: p.fetch });
for (const [scenario, latest] of [['active is latest',stableId],['newer non-active upload',candidateId],['candidate exists with zero traffic',candidateId],['script-level ETag/body differ',candidateId]]) {
  test(`${scenario}: only exact active UUID source is used`, async () => {
    const p = versionProvider(source);
    const fetch = p.fetch;
    p.fetch = async (url, options) => {
      // These mutable responses must never be consulted, regardless of latest.
      if (url.endsWith('/content/v2') || url.endsWith('/versions')) throw new Error(`mutable ${latest}`);
      return fetch(url,options);
    };
    const r = await read(p);
    assert.equal(r.source,source); assert.equal(r.versionId,stableId); assert.equal(r.sourceKind,VERSION_SOURCE);
    assert.equal(r.artifactSha256,artifactDigest(source)); assert.equal(p.calls.length,5);
    assert(!JSON.stringify(r).includes(source));
  });
}
for (const [name, changes] of [
  ['candidate masquerades as active', { scoped: v => { v.id = candidateId; } }],
  ['version metadata ID mismatch', { version: v => { v.id = candidateId; } }],
  ['metadata ETag drift', { version: (v,n) => { if(n>1)v.resources.script.etag='b'.repeat(64); } }],
  ['deployment ID drift', { deployment: (d,n) => { if(n>1)d.id=candidateId; } }],
  ['active version drift', { deployment: (d,n) => { if(n>1)d.versions[0].version_id=candidateId; } }],
  ['mixed positive deployment remains forbidden', { deployment: d => { d.versions[0].percentage=99; d.versions.push({version_id:candidateId,percentage:1}); } }],
  ['not numeric single100', { deployment: d => { d.versions[0].percentage='100'; } }],
  ['invalid timestamp', { deployment: d => { d.created_on='invalid'; } }],
  ['missing modules', { scoped: v => { delete v.modules; } }],
  ['ambiguous modules', { scoped: v => { v.modules.push({...v.modules[0]}); } }],
  ['wrong main module', { scoped: v => { v.main_module='other.js'; } }],
  ['invalid base64', { scoped: v => { v.modules[0].content_base64='not base64'; } }],
  ['invalid UTF8', { scoped: v => { v.modules[0].content_base64='/w=='; } }],
  ['HTTP failure', {httpFailure:true}], ['API failure',{apiFailure:true}], ['transport failure',{transportError:true}],
]) test(`${name}: fail closed with no mutable fallback or leaked cause`,async()=>{
  const p=versionProvider(source,changes);
  await assert.rejects(read(p), e=>e.message==='ACTIVE_VERSION_ARTIFACT_PROVENANCE_FAILED'&&e.cause===undefined&&!e.stack.includes('private'));
  assert(!p.calls.some(u=>u.endsWith('/content/v2')));
});
for(const id of [candidateId,'latest',stableId.slice(0,8)]) test(`non-exact or non-active requested identity ${id} blocks`,async()=>{
  await assert.rejects(read(versionProvider(source),id),/ACTIVE_VERSION_ARTIFACT_PROVENANCE_FAILED/);
});

test('staged exact100/0 reads only exact100 module provenance and records the complete distribution', async () => {
  const p=versionProvider(source,{deployment:d=>{d.versions.unshift({version_id:candidateId,percentage:0});}});
  const r=await read(p);assert.equal(r.versionId,stableId);assert.equal(r.source,source);
  assert.deepEqual(r.deploymentVersions,[{id:stableId,percentage:100},{id:candidateId,percentage:0}].sort((a,b)=>a.id.localeCompare(b.id)));
  assert(!p.calls.some(u=>u.includes('/versions/'+candidateId)));
});

for (const [name, rows] of [
  ['single stable', [[stableId, 100]]],
  ['zero first', [[candidateId, 0], [stableId, 100]]],
]) test(`${name}: plan selects only the unique numeric100 stable`, () => {
  assert.equal(captureStableVersion({ versions: rows.map(([id, percentage]) => ({ id, percentage })) }), stableId);
});

for (const [name, rows] of [
  ...[99, 90, 50, 99.999].map(p => [`split ${p}`, [[stableId, p], [candidateId, 100-p]]]),
  ['duplicate stable', [[stableId, 100], [stableId, 0]]],
  ['duplicate candidate', [[stableId, 100], [candidateId, 0], [candidateId, 0]]],
  ['same UUID twice', [[candidateId, 100], [candidateId, 0]]],
  ['two100', [[stableId, 100], [candidateId, 100]]],
  ['no100', [[stableId, 0], [candidateId, 0]]],
  ['string100', [[stableId, '100']]],
  ...[['string0','0'],['NaN',NaN],['null',null],['missing',undefined],['negative',-1],['above100',101]]
    .map(([name,p]) => [name, [[stableId,100],[candidateId,p]]]),
]) test(`${name}: provider reader and candidate plan both reject invalid distribution`, async () => {
  const versions = rows.map(([id,percentage])=>({id,percentage}));
  assert.throws(()=>captureStableVersion({versions}));
  await assert.rejects(read(versionProvider(source,{deployment:d=>{
    d.versions=versions.map(v=>({version_id:v.id,percentage:v.percentage}));
  }})), /ACTIVE_VERSION_ARTIFACT_PROVENANCE_FAILED/);
});
for(const [name,mutate] of [
 ['zero becomes string',d=>d.versions.push({version_id:candidateId,percentage:'0'})],
 ['duplicate stable UUID',d=>d.versions.push({version_id:stableId,percentage:0})],
 ['third version',d=>d.versions.push({version_id:candidateId,percentage:0},{version_id:'33333333-3333-4333-8333-333333333333',percentage:0})],
 ['malformed zero UUID',d=>d.versions.push({version_id:'latest',percentage:0})],
 ['zero-entry drift under same deployment ID', (d,n)=>d.versions.push({version_id:n===1?candidateId:'33333333-3333-4333-8333-333333333333',percentage:0})],
])test(name+': staged provenance fails closed',async()=>{
 await assert.rejects(read(versionProvider(source,{deployment:mutate})),/ACTIVE_VERSION_ARTIFACT_PROVENANCE_FAILED/);
});
