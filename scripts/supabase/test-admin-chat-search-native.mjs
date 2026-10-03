// Read/write synthetic fixtures in an isolated local PG17 process only. No remote URL accepted.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
const modules = process.env.PHONE_NATIVE_MODULES;
if (!modules) throw new Error('Set PHONE_NATIVE_MODULES to external embedded-postgres@17 / pg node_modules');
const require = createRequire(join(modules, '..', 'package.json'));
const EmbeddedPostgres = require('embedded-postgres').default;
const listener = createServer();
await new Promise(resolve => listener.listen(0,'127.0.0.1',resolve));
const port = listener.address().port;
await new Promise(resolve => listener.close(resolve));
const dir = await mkdtemp(join(tmpdir(),'locally-search-native-'));
const pg = new EmbeddedPostgres({ databaseDir:join(dir,'db'),user:'postgres',password:'local-fixture',port,persistent:false,
  postgresFlags:['-c','listen_addresses=127.0.0.1'],onLog:()=>{},onError:()=>{} });
let db;
try {
  await pg.initialise(); await pg.start();
  db = pg.getPgClient('postgres','127.0.0.1'); await db.connect();
  await db.query(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA extensions;
    CREATE TABLE profiles(id uuid PRIMARY KEY,full_name text,email text);
    CREATE TABLE experiences(id bigint PRIMARY KEY,title text);
    CREATE TABLE inquiries(id bigint PRIMARY KEY,user_id uuid,type text,experience_id bigint);
    CREATE TABLE proxy_requests(id uuid PRIMARY KEY,user_id uuid,category text,form_data jsonb,locally_order_id text);
    CREATE INDEX idx_pr_user ON proxy_requests(user_id);
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;
    INSERT INTO profiles SELECT md5(n::text)::uuid,'고객 '||n,'customer'||n||'@example.test' FROM generate_series(1,20000) n;
    INSERT INTO experiences SELECT n,'Experience '||n FROM generate_series(1,20000) n;
    INSERT INTO inquiries SELECT n,md5(n::text)::uuid,'admin_support',n FROM generate_series(1,20000) n;
    INSERT INTO proxy_requests SELECT md5(('request'||n)::text)::uuid,md5(n::text)::uuid,'RESTAURANT',
      jsonb_build_object('restaurant_name','Restaurant '||n,'contact_name','Contact '||n,'reservation_name','Reserved '||n), 'ORDER-'||n FROM generate_series(1,20000) n;
    UPDATE profiles SET full_name='김민수',email='MinSu@example.test' WHERE id=md5('42')::uuid;
    UPDATE experiences SET title='Kyoto Tea Experience' WHERE id=42;
    UPDATE proxy_requests SET form_data=form_data||'{"restaurant_name":"Kyoto Table"}' WHERE id=md5('request42')::uuid;
    UPDATE inquiries SET type='general' WHERE id=44;
    UPDATE proxy_requests SET form_data=form_data||'{"linked_inquiry_id":"43"}' WHERE id=md5('request43')::uuid;
    UPDATE proxy_requests SET form_data=form_data||'{"linked_inquiry_id":"45","__proxy_card_anchor":"v1"}' WHERE id=md5('request45')::uuid;
    UPDATE profiles SET full_name='literal%_\\name' WHERE id=md5('46')::uuid;
    INSERT INTO proxy_requests VALUES (md5('duplicate43')::uuid,md5('43')::uuid,'GENERAL','{"linked_inquiry_id":"43"}',NULL);
    UPDATE proxy_requests SET form_data=form_data||'{"linked_inquiry_id":"47"}' WHERE id=md5('request48')::uuid;
    UPDATE proxy_requests SET form_data=form_data||'{"linked_inquiry_id":"49"}' WHERE id=md5('request49')::uuid;
  `);
  const migration = await readFile('supabase/migrations/20261003122803_admin_chat_bounded_search.sql','utf8');
  const before = (await db.query('SELECT row_to_json(i) AS row FROM inquiries i ORDER BY id')).rows;
  await db.query(migration);
  assert.deepEqual((await db.query('SELECT row_to_json(i) AS row FROM inquiries i ORDER BY id')).rows,before);
  for(const role of ['anon','authenticated']) {
    await db.query('SET ROLE '+role);
    await assert.rejects(db.query("SELECT * FROM search_admin_chat('support','42')"), { code:'42501' });
    await db.query('RESET ROLE');
  }
  await db.query('ANALYZE; SET ROLE service_role');
  const search = async (surface,q) => (await db.query('SELECT * FROM search_admin_chat($1,$2)',[surface,q])).rows;
  const has = async (surface,q,id) => assert.ok((await search(surface,q)).some(row=>row.id===id), `${surface} ${q} => ${id}`);
  const request42 = (await db.query("SELECT md5('request42')::uuid AS id")).rows[0].id;
  await has('support','42','42'); await has('support','#1','1'); await has('support','김민','42'); await has('support','김민수','42');
  await has('support','MINSU@EXAMPLE.TEST','42'); await has('support','nsu@','42'); await has('support','Kyoto Tea Experience','42'); await has('support','Tea','42');
  for(const q of [request42,request42.slice(0,8),'ORDER-42','김민수','minsu@','Kyoto Table','Contact 42','Reserved 42']) await has('phone',q,request42);
  assert.equal((await search('support','#44')).length,0); // monitor excluded
  assert.equal((await search('support','#49')).length,0); // valid phone link excluded
  await has('support','#43','43'); // duplicate link stays Support
  await has('support','#45','45'); // anchor excluded from formal links
  await has('support','#47','47'); // mismatched customer stays Support
  assert.equal((await search('phone',(await db.query("SELECT md5('request45')::uuid AS id")).rows[0].id)).length,0);
  await has('support','%_','46'); await has('support','\\name','46');
  for(const surface of ['support','phone']) {
    assert.equal((await search(surface,'a')).length,0); assert.equal((await search(surface,'a'.repeat(101))).length,0);
    const broad = await search(surface,surface==='support'?'고객':'Restaurant'); assert.equal(broad.length,25);
    assert.deepEqual(await search(surface,surface==='support'?'고객':'Restaurant'),broad);
  }
  // Exact IDs rank first even among many partial ID matches.
  assert.equal((await search('support','42'))[0].id,'42'); assert.equal((await search('phone','ORDER-42'))[0].id,request42);
  const timings=[];
  for(const [surface,q] of [['support','고객'],['support','Tea'],['support','42'],['phone','Restaurant'],['phone','minsu@'],['phone',request42]]) {
    const started=performance.now(); const result=await search(surface,q); const ms=performance.now()-started;
    assert.ok(ms<2000, `fixture search too slow: ${surface} ${q}: ${ms}`);
    timings.push({surface,q,rows:result.length,ms:Number(ms.toFixed(2))});
  }
  await db.query('RESET ROLE; SET enable_seqscan=off');
  for(const [sql,index] of [
    ["SELECT id FROM profiles WHERE email ILIKE '%minsu%'",'admin_chat_profile_email_search'],
    ["SELECT id FROM experiences WHERE title ILIKE '%Tea%'",'admin_chat_experience_title_search'],
    ["SELECT id FROM proxy_requests WHERE private.admin_chat_phone_title(category,form_data) ILIKE '%Kyoto%'",'admin_chat_phone_title_search'],
  ]) assert.match(JSON.stringify((await db.query('EXPLAIN (FORMAT JSON) '+sql)).rows),new RegExp(index));
  const definition=(await db.query("SELECT pg_get_functiondef('search_admin_chat(text,text)'::regprocedure) AS sql")).rows[0].sql;
  assert.doesNotMatch(definition,/inquiry_messages|\bUPDATE\b|\bINSERT\b|\bDELETE\b|\bLOOP\b|SECURITY DEFINER/i);
  console.log('PHASE3B_NATIVE',JSON.stringify({fixtures:{inquiries:20000,requests:20001},timings,authorization:'anon/authenticated denied',businessWrites:0}));
} finally { if(db) await db.end(); await pg.stop().catch(()=>{}); await rm(dir,{recursive:true,force:true}); }
