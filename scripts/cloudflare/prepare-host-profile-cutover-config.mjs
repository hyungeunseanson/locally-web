import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {HOST_PROFILE_BUCKET} from '../../app/utils/hostProfileMediaContract.mjs';
/** Offline overlay; requires the completed Avatar release baseline, adds Host only. */
export function prepareHostProfileCutoverConfig(base,enabled='false'){
 assert(['false','true'].includes(enabled),'host_profile_flag_invalid');const result=structuredClone(base),p=result.env?.production;
 assert(result.keep_vars===true&&p?.name==='locally-web-opennext-production'&&p.vars?.AVATAR_R2_SOURCE_ENABLED==='true','host_profile_completed_avatar_baseline_required');
 assert(p.r2_buckets?.filter(b=>b.binding==='PUBLIC_AVATAR_R2'&&b.bucket_name==='locally-public-avatars').length===1,'host_profile_avatar_binding_required');
 const matches=p.r2_buckets.filter(b=>b.binding==='PUBLIC_HOST_PROFILE_SOURCE_R2'||b.bucket_name===HOST_PROFILE_BUCKET);
 assert(matches.length<=1&&matches.every(b=>b.binding==='PUBLIC_HOST_PROFILE_SOURCE_R2'&&b.bucket_name===HOST_PROFILE_BUCKET),'host_profile_binding_collision');
 if(!matches.length)p.r2_buckets.push({binding:'PUBLIC_HOST_PROFILE_SOURCE_R2',bucket_name:HOST_PROFILE_BUCKET});
 p.vars.HOST_PROFILE_R2_SOURCE_ENABLED=enabled;const normalized=structuredClone(result);normalized.env.production.r2_buckets=structuredClone(base.env.production.r2_buckets);normalized.env.production.vars=structuredClone(base.env.production.vars);assert.deepEqual(normalized,base,'host_profile_unrelated_configuration_change');return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const a=Object.fromEntries(process.argv.slice(2).map(x=>x.replace(/^--/,'').split('=')));if(!a.input||!a.output)throw Error('host_profile_paths_required');const value=prepareHostProfileCutoverConfig(JSON.parse(await readFile(a.input,'utf8')),a.enabled??'false');await writeFile(a.output,JSON.stringify(value,null,2)+'\n',{mode:0o600});console.log(JSON.stringify({mode:'offline-config-only',bucket:HOST_PROFILE_BUCKET,providerWrites:0}));}
