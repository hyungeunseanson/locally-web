// Real native PG17 + upstream safeupdate; only loopback synthetic data.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {setupCommunityDatabase,beginCommunity,commitSet,owner,old1,old2,roleQuery} from '../../tests/integration/community-media.scenario.mjs';
import {communityKey,COMMUNITY_BASE_URL} from '../../app/utils/communityMediaContract.mjs';

const modules=process.env.COMMUNITY_PG17_MODULES,library=process.env.COMMUNITY_SAFEUPDATE_LIBRARY;
assert(modules && /^\/[A-Za-z0-9_./-]+\.so$/.test(library ?? ''),'isolated native fixture and safeupdate library required');
const require=createRequire(join(modules,'../package.json')),EmbeddedPostgres=require('embedded-postgres').default;
const dir=await mkdtemp(join(tmpdir(),'community-freeze-pg17-'));
const listener=createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));
const port=listener.address().port;await new Promise(r=>listener.close(r));
const pg=new EmbeddedPostgres({databaseDir:join(dir,'db'),user:'postgres',password:'local-only-synthetic',port,persistent:false,postgresFlags:['-c','listen_addresses=127.0.0.1'],onLog:()=>{},onError:()=>{}});
let client;
try {
  await pg.initialise();await pg.start();client=pg.getPgClient('postgres','127.0.0.1');await client.connect();
  const db={query:(...a)=>client.query(...a),exec:s=>client.query(s)};
  assert.match((await db.query("SELECT current_setting('server_version') v")).rows[0].v,/^17\.6/);
  const original=await readFile('supabase/migrations/20261006105322_community_media_authority.sql');
  assert.equal(createHash('sha256').update(original).digest('hex'),'55ac4184288d9213e31b4f40de928d7ccfd4c02765db90c0d2d7f8858c597912');
  await setupCommunityDatabase(db,{applyFreezeHotfix:false});
  const smoke=await beginCommunity(db);await commitSet(db,[smoke.url],0,[old1,old2]);
  const catalog=async()=> (await db.query(`SELECT n.nspname||'.'||p.oid::regprocedure::text identity,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef,p.proconfig,md5(p.prosrc) body FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private','storage','auth') ORDER BY 1`)).rows;
  const beforeCatalog=await catalog();
  const unrelated=async()=>Promise.all(['public.profiles','public.host_applications','auth.users','auth.sessions','storage.objects','storage.buckets','public.community_posts','public.media_assets','public.media_asset_references','public.media_deletion_journal'].map(async table=>(await db.query(`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) rows FROM ${table} t`)).rows[0].rows));
  const beforeRows=await unrelated();
  await db.exec(`LOAD '${library}'`);
  assert.equal((await db.query("SELECT current_setting('safeupdate.enabled') enabled")).rows[0].enabled,'on');
  const freeze=(value,id=smoke.id,sha=smoke.sha)=>roleQuery(db,'service_role','SELECT public.set_community_legacy_writer_freeze($1,$2,$3) result',[value,id,sha]);
  await assert.rejects(freeze(true),e=>e.code==='21000' && e.message==='UPDATE requires a WHERE clause');
  assert.equal((await db.query('SELECT legacy_writes_frozen frozen FROM private.community_media_authority')).rows[0].frozen,false);
  await db.exec(await readFile('supabase/migrations/20261006173453_community_freeze_safeupdate.sql','utf8'));
  const afterCatalog=await catalog();
  assert.deepEqual(afterCatalog.map(p=>p.identity.includes('private.set_community_legacy_writer_freeze(')?{...p,body:null}:p),beforeCatalog.map(p=>p.identity.includes('private.set_community_legacy_writer_freeze(')?{...p,body:null}:p));
  assert.equal((await freeze(true)).rows[0].result,true);
  assert.equal((await db.query('SELECT legacy_writes_frozen frozen FROM private.community_media_authority')).rows[0].frozen,true);
  assert.equal((await freeze(false)).rows[0].result,false);
  assert.equal((await db.query('SELECT legacy_writes_frozen frozen FROM private.community_media_authority')).rows[0].frozen,false);
  for(const [value,id,sha] of [[true,randomUUID(),smoke.sha],[true,smoke.id,'b'.repeat(64)],[null,smoke.id,smoke.sha]])await assert.rejects(freeze(value,id,sha),e=>e.code==='23514' && e.message==='community_verified_smoke_required');
  for(const role of ['anon','authenticated'])await assert.rejects(roleQuery(db,role,'SELECT public.set_community_legacy_writer_freeze(true,$1,$2)',[smoke.id,smoke.sha]),e=>e.code==='42501');
  assert.deepEqual(await unrelated(),beforeRows,'freeze must mutate no unrelated rows');
  const pending=randomUUID(),key=communityKey(owner,pending),url=COMMUNITY_BASE_URL+'/'+key;
  await roleQuery(db,'service_role','SELECT public.begin_community_media_asset($1,$2,$3,$4,$5,4,$6,$7)',[pending,owner,key,url,smoke.sha,'image/jpeg',createHash('sha256').update(pending).digest('hex')]);
  await assert.rejects(freeze(true,pending,smoke.sha),e=>e.code==='23514');
  await db.exec('BEGIN');
  try {
    await db.exec('DELETE FROM private.community_media_authority WHERE singleton IS TRUE');
    await assert.rejects(db.query('SELECT public.set_community_legacy_writer_freeze(true,$1,$2)',[smoke.id,smoke.sha]),e=>e.code==='42501' && e.message==='community_authority_singleton_required');
  } finally { await db.exec('ROLLBACK'); }
  assert.equal((await db.query('SELECT count(*)::int n FROM private.community_media_authority WHERE singleton IS TRUE')).rows[0].n,1);
  await assert.rejects(db.exec('UPDATE private.community_media_authority SET legacy_writes_frozen=true'),e=>e.code==='21000');
  assert.equal((await db.query("SELECT current_setting('safeupdate.enabled') enabled")).rows[0].enabled,'on');
  console.log('COMMUNITY_FREEZE_NATIVE_PG17_SAFEUPDATE_REPRO_FIX_ROLLBACK_ACL_SINGLETON_UNRELATED PASS');
} finally { await client?.end().catch(()=>{});await pg.stop().catch(()=>{});await rm(dir,{recursive:true,force:true}); }
