#!/usr/bin/env node
// Read-only byte evidence. Never logs URLs, object keys, row IDs or payloads.
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {build} from 'esbuild';
import {legacyHostProfileKey,hostProfileMime} from '../../app/utils/hostProfileMediaContract.mjs';
const base = 'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/images/';
const args = Object.fromEntries(process.argv.slice(2).map(v => v.replace(/^--/, '').split('=')));
const sha = v => createHash('sha256').update(v).digest('hex');
try {
  const inventory = JSON.parse(await readFile(args.inventory, 'utf8'));
  if (!Array.isArray(inventory.references) || !Array.isArray(inventory.objects) || inventory.references.length > 5000 || inventory.objects.length > 1000) throw Error('inventory_bounds');
  const bundle=await build({entryPoints:['app/utils/hostProfileMedia.ts'],bundle:true,platform:'node',format:'esm',write:false});
  const {validateHostProfileImage}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  const keys = new Set(),selectedReferences=[];
  for (const ref of inventory.references) {
    const key=legacyHostProfileKey(ref.locator);if(key===null)continue;keys.add(key);selectedReferences.push(ref);
  }
  const objects = inventory.objects.filter(o => keys.has(o.key));
  if (objects.length !== keys.size || objects.length > 200 || objects.reduce((n,o)=>n+o.size,0) > 128*1024*1024) throw Error('source_bounds_or_missing');
  const proof = [];
  for (const item of objects) {
    const refs = selectedReferences.filter(r=>r.locator===base+item.key);
    if (refs.some(r=>r.owner!==item.owner)||item.key.split('/')[1].split('_')[0]!==item.owner) throw Error('owner_mismatch');
    const response = await fetch(base+item.key, { redirect:'error', cache:'no-store', signal:AbortSignal.timeout(30000), headers:{'Accept-Encoding':'identity'} });
    if (!response.ok) { await response.body?.cancel(); throw Error('source_http_'+response.status); }
    const mime=hostProfileMime(response.headers.get('content-type'));
    const chunks=[];let size=0;const reader=response.body.getReader();
    try { while(true) { const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>10*1024*1024)throw Error('byte_limit');chunks.push(value); } }
    finally { await reader.cancel();reader.releaseLock(); }
    const bytes=Buffer.concat(chunks);
    if(size!==item.size)throw Error('source_size_mismatch');
    if(mime!==item.mime)throw Error('source_mime_mismatch');
    validateHostProfileImage(bytes,mime);
    proof.push({ objectDigest:sha(item.key), byteSha256:sha(bytes),size,mime,references:refs.length });
  }
  const result={observedAt:new Date().toISOString(),inventoryDigest:sha(JSON.stringify(inventory)),objects:proof.length,bytes:proof.reduce((n,p)=>n+p.size,0),references:selectedReferences.length,byteEvidenceDigest:sha(JSON.stringify(proof)),missing:0,ownerMismatch:0,sizeMismatch:0,mimeMismatch:0,sourceWrites:0,sourceDeletes:0,productionMutations:0,proof};
  await writeFile(args.output,JSON.stringify(result,null,2)+'\n',{mode:0o600});await chmod(args.output,0o600);
  const {proof:privateEvidence,...summary}=result;void privateEvidence;console.log(JSON.stringify(summary));
} catch(error) { console.error(JSON.stringify({status:'blocked',code:/^[a-z_0-9]+$/.test(error.message)?error.message:'read_only_audit_failed',productionMutations:0}));process.exitCode=1; }
