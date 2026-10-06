// Native PostgreSQL 17, loopback only. No remote URL or Production key accepted.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {setupHostDatabase,runHostScenario,owner,oldUrl,beginHost,groupRefs} from '../../tests/integration/host-profile-media.scenario.mjs';
const modules=process.env.HOST_PG17_MODULES;if(!modules)throw Error('HOST_PG17_MODULES required (external embedded-postgres@17.6.0-beta.15 / pg)');
const require=createRequire(join(modules,'../package.json'));const EmbeddedPostgres=require('embedded-postgres').default;
const dir=await mkdtemp(join(tmpdir(),'locally-host-pg17-'));const listener=createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
const pg=new EmbeddedPostgres({databaseDir:join(dir,'db'),user:'postgres',password:'local-only-synthetic',port,persistent:false,postgresFlags:['-c','listen_addresses=127.0.0.1'],onLog:()=>{},onError:()=>{}}),clients=[];
try{await pg.initialise();await pg.start();for(let i=0;i<3;i++){const c=pg.getPgClient('postgres','127.0.0.1');await c.connect();clients.push(c);}const [base,writer,migration]=clients;const db={query:(...a)=>base.query(...a),exec:s=>base.query(s)};
 assert.match((await base.query("SELECT current_setting('server_version') v")).rows[0].v,/^17\.6/);await setupHostDatabase(db);await runHostScenario(db);
 // Restore synthetic legacy state with the unarmed gate, then race a committed newer edit.
 await base.query('UPDATE private.host_profile_source_authority SET r2_enabled=false');await base.query('UPDATE profiles SET avatar_url=$1 WHERE id=$2',[oldUrl,owner]);await base.query('INSERT INTO host_applications VALUES($1,$1,$2)',[owner,oldUrl]);await base.query('UPDATE host_applications SET profile_photo=$1 WHERE user_id=$2',[oldUrl,owner]);await base.query("UPDATE auth.users SET raw_user_meta_data=jsonb_set(raw_user_meta_data,'{avatar_url}',to_jsonb($1::text)) WHERE id=$2",[oldUrl,owner]);
 await base.query('UPDATE private.host_profile_source_authority SET r2_enabled=true');const asset=await beginHost(db),refs=await groupRefs(db);await writer.query('BEGIN');await writer.query('UPDATE host_applications SET profile_photo=$1 WHERE id=$2',['https://external.example/newer',owner]);
 await migration.query('BEGIN; SET LOCAL ROLE service_role; SET LOCAL statement_timeout=5000');let settled=false;const pending=migration.query('SELECT public.apply_host_profile_media_locators($1,$2,$3,$4,false)',[owner,asset.id,oldUrl,JSON.stringify(refs)]).then(()=>{settled=true;return null;},e=>{settled=true;return e;});
 // Observe actual blocking via pg_stat_activity; no timing-only race assertion.
 const until=Date.now()+4000;let blocked=false;while(Date.now()<until){const r=await base.query("SELECT count(*)::int n FROM pg_stat_activity WHERE pid=$1 AND wait_event_type='Lock'",[migration.processID]);if(r.rows[0].n){blocked=true;break;}}
 assert(blocked&&!settled);await writer.query('COMMIT');const error=await pending;assert.equal(error?.code,'40001');await migration.query('ROLLBACK');assert.equal((await base.query('SELECT profile_photo FROM host_applications WHERE id=$1',[owner])).rows[0].profile_photo,'https://external.example/newer');assert.equal((await base.query('SELECT avatar_url FROM profiles WHERE id=$1',[owner])).rows[0].avatar_url,oldUrl);assert.equal((await base.query('SELECT raw_user_meta_data FROM auth.users WHERE id=$1',[owner])).rows[0].raw_user_meta_data.avatar_url,oldUrl);console.log('HOST_NATIVE_PG17_ATOMIC_RACE PASS');
}finally{for(const c of clients)await c.end().catch(()=>{});await pg.stop().catch(()=>{});await rm(dir,{recursive:true,force:true});}
