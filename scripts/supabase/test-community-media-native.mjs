// Native PostgreSQL 17, loopback only. No remote URL or Production key accepted.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {COMMUNITY_LEGACY_BASE} from '../../app/utils/communityMediaContract.mjs';
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {setupCommunityDatabase,runCommunityScenario,owner,post1,beginCommunity} from '../../tests/integration/community-media.scenario.mjs';
const modules=process.env.COMMUNITY_PG17_MODULES;if(!modules)throw Error('COMMUNITY_PG17_MODULES required (external embedded-postgres@17.6.0-beta.15 / pg)');
const require=createRequire(join(modules,'../package.json'));const EmbeddedPostgres=require('embedded-postgres').default;
const dir=await mkdtemp(join(tmpdir(),'locally-community-pg17-'));const listener=createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
const pg=new EmbeddedPostgres({databaseDir:join(dir,'db'),user:'postgres',password:'local-only-synthetic',port,persistent:false,postgresFlags:['-c','listen_addresses=127.0.0.1'],onLog:()=>{},onError:()=>{}}),clients=[];
try{await pg.initialise();await pg.start();for(let i=0;i<3;i++){const c=pg.getPgClient('postgres','127.0.0.1');await c.connect();clients.push(c);}const [base,writer,migration]=clients;const db={query:(...a)=>base.query(...a),exec:s=>base.query(s)};
 assert.match((await base.query("SELECT current_setting('server_version') v")).rows[0].v,/^17\.6/);await setupCommunityDatabase(db);
 const state=await runCommunityScenario(db);
 // Actual PG17 row-lock race: stale CAS waits, then rejects after the newer commit.
 const next=await beginCommunity(db);await writer.query('BEGIN');
 await writer.query('SELECT public.commit_community_post_images($1,$2,$3,$4,$5)',[owner,post1,state.raceRevision,state.raceImages,[next.url]]);
 await migration.query('BEGIN; SET LOCAL ROLE service_role; SET LOCAL statement_timeout=5000');let settled=false;
 const pending=migration.query('SELECT public.commit_community_post_images($1,$2,$3,$4,$5)',[owner,post1,state.raceRevision,state.raceImages,[]]).then(()=>{settled=true;return null;},e=>{settled=true;return e;});
 const until=Date.now()+4000;let blocked=false;while(Date.now()<until){const r=await base.query("SELECT count(*)::int n FROM pg_stat_activity WHERE pid=$1 AND wait_event_type='Lock'",[migration.processID]);if(r.rows[0].n){blocked=true;break;}}
 assert(blocked&&!settled);await writer.query('COMMIT');const error=await pending;assert.equal(error?.code,'40001');await migration.query('ROLLBACK');
 assert.deepEqual((await base.query('SELECT images FROM community_posts WHERE id=$1',[post1])).rows[0].images,[next.url]);console.log('COMMUNITY_NATIVE_PG17_LOCK_RACE PASS');
 // Real writer vs whole migration CAS: migration waits on parent lock and refuses newer image set.
 await base.query('UPDATE private.community_media_authority SET legacy_writes_frozen=false');
 const racePost=randomUUID(),sourceKey='community/race.jpg',oldUrl=COMMUNITY_LEGACY_BASE+sourceKey;
 const inserted=await base.query("INSERT INTO storage.objects(name,owner_id,bucket_id,version,metadata) VALUES($1,$2,'images','v1','{\"size\":4,\"mimetype\":\"image/jpeg\"}') RETURNING updated_at",[sourceKey,owner]);
 await base.query('INSERT INTO community_posts(id,user_id,images) VALUES($1,$2,$3)',[racePost,owner,[oldUrl]]);
 await base.query('SELECT public.set_community_legacy_writer_freeze(true,$1,$2)',[next.id,next.sha]);
 const prepared=await beginCommunity(db),newer=await beginCommunity(db);
 const assets=[{id:prepared.id,owner,sourceKey,oldUrl,newUrl:prepared.url,sha256:prepared.sha,size:4,mime:'image/jpeg',version:'v1',updatedAt:inserted.rows[0].updated_at}],posts=[{id:racePost,owner,revision:0,oldImages:[oldUrl],newImages:[prepared.url]}];
 await writer.query('BEGIN');await writer.query('SELECT public.commit_community_post_images($1,$2,0,$3,$4)',[owner,racePost,[oldUrl],[newer.url]]);
 await migration.query('BEGIN; SET LOCAL ROLE service_role; SET LOCAL statement_timeout=5000');let migrationSettled=false;
 const migrating=migration.query('SELECT public.apply_community_media_locators($1,$2,$3,false)',['f'.repeat(64),JSON.stringify(assets),JSON.stringify(posts)]).then(()=>{migrationSettled=true;return null},e=>{migrationSettled=true;return e});
 const migrationUntil=Date.now()+4000;let migrationBlocked=false;while(Date.now()<migrationUntil){if((await base.query("SELECT count(*)::int n FROM pg_stat_activity WHERE pid=$1 AND wait_event_type='Lock'",[migration.processID])).rows[0].n){migrationBlocked=true;break;}}
 assert(migrationBlocked&&!migrationSettled);await writer.query('COMMIT');assert.equal((await migrating)?.code,'40001');await migration.query('ROLLBACK');assert.deepEqual((await base.query('SELECT images FROM community_posts WHERE id=$1',[racePost])).rows[0].images,[newer.url]);assert.equal((await base.query('SELECT state FROM media_assets WHERE id=$1',[prepared.id])).rows[0].state,'pending');console.log('COMMUNITY_NATIVE_PG17_MIGRATION_LOCK_RACE PASS');

}finally{for(const c of clients)await c.end().catch(()=>{});await pg.stop().catch(()=>{});await rm(dir,{recursive:true,force:true});}
