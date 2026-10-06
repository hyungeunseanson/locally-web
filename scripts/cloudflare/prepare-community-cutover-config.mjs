import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {COMMUNITY_BUCKET} from '../../app/utils/communityMediaContract.mjs';
/** Offline overlay; requires completed Avatar/Host/Experience baseline; adds Community only. */
export function prepareCommunityCutoverConfig(base,enabled='false'){
 assert(['false','true'].includes(enabled),'community_flag_invalid');const result=structuredClone(base),p=result.env?.production;
 assert(result.keep_vars===true&&p?.name==='locally-web-opennext-production'&&p.vars?.AVATAR_R2_SOURCE_ENABLED==='true','community_completed_avatar_baseline_required');
 assert(p.vars.HOST_PROFILE_R2_SOURCE_ENABLED==='true'&&['true','false'].includes(p.vars.EXPERIENCE_MEDIA_R2_SOURCE_ENABLED),'community_completed_sources_required');
 assert(p.r2_buckets?.filter(b=>b.binding==='PUBLIC_AVATAR_R2'&&b.bucket_name==='locally-public-avatars').length===1,'community_avatar_binding_required');
 assert(p.r2_buckets.some(b=>b.binding==='PUBLIC_EXPERIENCE_MEDIA_R2'&&b.bucket_name==='locally-public-experience-canary'),'community_experience_source_binding_required');
 const matches=p.r2_buckets.filter(b=>b.binding==='PUBLIC_COMMUNITY_SOURCE_R2'||b.bucket_name===COMMUNITY_BUCKET);
 assert(matches.length<=1&&matches.every(b=>b.binding==='PUBLIC_COMMUNITY_SOURCE_R2'&&b.bucket_name===COMMUNITY_BUCKET),'community_binding_collision');
 if(!matches.length)p.r2_buckets.push({binding:'PUBLIC_COMMUNITY_SOURCE_R2',bucket_name:COMMUNITY_BUCKET});
 p.vars.COMMUNITY_R2_SOURCE_ENABLED=enabled;const normalized=structuredClone(result);normalized.env.production.r2_buckets=structuredClone(base.env.production.r2_buckets);normalized.env.production.vars=structuredClone(base.env.production.vars);assert.deepEqual(normalized,base,'community_unrelated_configuration_change');return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const a=Object.fromEntries(process.argv.slice(2).map(x=>x.replace(/^--/,'').split('=')));if(!a.input||!a.output)throw Error('community_paths_required');const value=prepareCommunityCutoverConfig(JSON.parse(await readFile(a.input,'utf8')),a.enabled??'false');await writeFile(a.output,JSON.stringify(value,null,2)+'\n',{mode:0o600});console.log(JSON.stringify({mode:'offline-config-only',bucket:COMMUNITY_BUCKET,providerWrites:0}));}
