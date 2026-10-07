// Called only by the isolated PG17 recency runner; never accepts remote credentials.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
export async function testMonitorRecency({db,check,client,load,customer,admin,add,definitions}) {
  const before=await definitions(),indexBefore=(await db.query("SELECT pg_get_indexdef('admin_chat_visible_message_recency'::regclass) AS definition")).rows;
  await db.query(await readFile('supabase/migrations/20261007024725_admin_chat_monitor_canonical_recency.sql','utf8'));
  await db.query(await readFile('supabase/staging/admin-monitor-recency-target-contract.sql','utf8'));
  const monitor=async(query='')=>{const result=await load('app/api/admin/inquiries/route.ts').GET(new Request('http://fixture.test/api?view=monitor&'+query));assert.equal(result.status,200);return result.json();};
  const recency=async ids=>(await client.rpc('list_admin_monitor_recency',{p_offset:0,p_limit:100,p_inquiry_ids:ids})).data;
  const single=async id=>(await db.query('SELECT canonical_activity_at::text AS time FROM list_admin_monitor_recency(0,1,$1)',[[id]])).rows[0].time;
  const transaction=async run=>{await db.query('BEGIN');try{await run();}finally{await db.query('ROLLBACK');}};
  const seed=async total=>{
    await db.query(`INSERT INTO inquiries(id,user_id,type,status,content,created_at,updated_at)
      SELECT 1000+n,'${customer}',CASE WHEN n%2=0 THEN NULL ELSE 'general' END,CASE WHEN n%3=0 THEN 'resolved' ELSE 'open' END,'fixture',
        '2025-01-01'::timestamptz+n*interval '1 minute','2040-01-01'::timestamptz-n*interval '1 minute' FROM generate_series(1,$1)n`,[total]);
    await db.query(`INSERT INTO inquiry_messages(inquiry_id,sender_id,content,type,created_at)
      SELECT 1000+n,'${customer}','fixture',CASE WHEN n%3=0 THEN NULL WHEN n%3=1 THEN 'text' ELSE 'image' END,
        '2026-10-07'::timestamptz+n*interval '1 minute' FROM generate_series(1,$1)n`,[total]);
  };
  await check('Monitor DB: existing RPC definitions/index bytes preserved, one additive read function',async()=>{
    assert.deepEqual((await definitions()).filter(row=>!row.name.startsWith('list_admin_monitor_recency')),before);
    assert.deepEqual((await db.query("SELECT pg_get_indexdef('admin_chat_visible_message_recency'::regclass) AS definition")).rows,indexBefore);
    const [row]=(await db.query(`SELECT provolatile,prosecdef,proconfig,proacl::text,
      has_function_privilege('anon',oid,'EXECUTE') AS anon,has_function_privilege('authenticated',oid,'EXECUTE') AS authenticated,
      has_function_privilege('service_role',oid,'EXECUTE') AS service FROM pg_proc WHERE proname='list_admin_monitor_recency'`)).rows;
    assert.equal(row.provolatile,'s');assert.equal(row.prosecdef,false);assert.ok(row.proconfig.includes('search_path=""'));assert.equal(row.anon,false);assert.equal(row.authenticated,false);assert.equal(row.service,true);assert.doesNotMatch(row.proacl,/(?:^|[,\{])=X/);
    for(const role of ['anon','authenticated']){await db.query(`SET ROLE ${role}`);await assert.rejects(db.query('SELECT * FROM list_admin_monitor_recency()'),{code:'42501'});await db.query('RESET ROLE');}
    await db.query('GRANT SELECT ON inquiries,inquiry_messages TO service_role');await db.query('SET ROLE service_role');await db.query('SELECT * FROM list_admin_monitor_recency()');await db.query('RESET ROLE');
  });
  for(const total of [48,50,51,75,125])await check(`Monitor DB/API ${total}: global order before pagination; IN enrichment restores exact order`,()=>transaction(async()=>{
    await seed(total);const all=[];for(let offset=0;;offset+=50){const page=await monitor(`offset=${offset}&limit=50`);assert.ok(page.data.length<=50);all.push(...page.data.map(row=>row.id));if(!page.pagination.hasMore)break;}
    assert.deepEqual(all,Array.from({length:total},(_,n)=>String(1000+total-n)));assert.equal(new Set(all).size,total);
    const query=await monitor('needsReply=true&unseen=true&status=resolved');assert.deepEqual(query.data.map(row=>row.id),all.slice(0,50),'Monitor never inherits Support operational/status filters');
  }));
  for(const [label,sender]of [['customer',customer],['admin unread=0',admin]])await check(`Monitor #51 ${label} visible activity enters page1 row1`,()=>transaction(async()=>{
    await seed(51);if(sender===admin)await db.query('UPDATE inquiry_messages SET admin_read_at=now() WHERE inquiry_id=1001');assert.ok(!(await monitor()).data.some(row=>row.id==='1001'));await add(1001,sender,'text','2026-10-08');const page=await monitor();assert.equal(page.data[0].id,'1001');assert.equal(page.data.length,50);if(sender===admin)assert.equal(Number(page.data[0].admin_unread_count),0);
  }));
  await check('Monitor latest deletion moves down; older deletion unchanged; hard deletion falls back',()=>transaction(async()=>{
    await seed(2);const before=await single(1001);const latest=(await add(1001,customer,'text','2030-01-01')).rows[0].id;assert.equal((await monitor()).data[0].id,'1001');
    await db.query("UPDATE inquiry_messages SET type='deleted' WHERE id=$1",[latest]);assert.equal(await single(1001),before);assert.equal((await monitor()).data[0].id,'1002');
    const older=(await add(1001,customer,'text','2020-01-01')).rows[0].id;await db.query("UPDATE inquiry_messages SET type='deleted' WHERE id=$1",[older]);assert.equal(await single(1001),before);
    await db.query('DELETE FROM inquiry_messages WHERE inquiry_id=1001');assert.equal(await single(1001),'2025-01-01 00:01:00+00');
  }));
  await check('Monitor actual ACK/read/status/policy parent metadata does not change canonical order/time',()=>transaction(async()=>{
    await seed(2);const before=await recency(null);await db.query("UPDATE inquiries SET updated_at='2045-01-01',status='resolved',content='new metadata' WHERE id=1001");
    const ids=(await db.query('SELECT id::text FROM inquiry_messages WHERE inquiry_id=1001')).rows.map(row=>row.id);
    await db.query('SELECT * FROM ack_admin_inquiry_snapshot($1,$2)',[1001,ids]);await db.query('UPDATE inquiry_messages SET is_read=true,read_at=now() WHERE inquiry_id=1001');assert.deepEqual(await recency(null),before);
  }));
  await check('Monitor fallback, hidden workflow/deleted exclusions, microseconds, numeric bigint conversation ties, message ID ties',()=>transaction(async()=>{
    await db.query(`INSERT INTO inquiries(id,user_id,type,created_at,updated_at) VALUES(9007199254741992,'${customer}',null,'2030-01-01','2040-01-01'),(9007199254741993,'${customer}','other','2030-01-01','2020-01-01')`);
    assert.deepEqual((await monitor()).data.map(row=>row.id),['9007199254741993','9007199254741992']);
    await add('9007199254741992',customer,'workflow','2040-01-01');await add('9007199254741992',customer,'deleted','2040-01-01');assert.equal((await monitor()).data[0].id,'9007199254741993');
    await add('9007199254741992',customer,'text','2030-01-01T00:00:00.000001Z');assert.equal((await monitor()).data[0].id,'9007199254741992');
    const last=await add('9007199254741992',admin,'image','2030-01-01T00:00:00.000001Z');
    const picked=(await db.query("SELECT id::text FROM inquiry_messages WHERE inquiry_id=9007199254741992 AND coalesce(type,'text') IN ('text','image') ORDER BY created_at DESC,id DESC LIMIT 1")).rows[0].id;assert.equal(picked,last.rows[0].id);
    const definition=(await db.query("SELECT prosrc FROM pg_proc WHERE proname='list_admin_monitor_recency'")).rows[0].prosrc;assert.match(definition,/im.created_at DESC, im.id DESC LIMIT 1/);
  }));
  await check('Monitor off-page deep link separately enriched: canonical 50 rows/hasMore unchanged; search/detail/profile/policy data preserved',()=>transaction(async()=>{
    await seed(75);const before=await monitor(),linked=await monitor('inquiryId=1001');assert.deepEqual(linked.data,before.data);assert.deepEqual(linked.pagination,before.pagination);assert.equal(linked.resolvedInquiry.id,'1001');assert.equal(linked.selection.view,'monitor');assert.equal(linked.resolvedInquiry.guest.name,'Fixture customer');assert.equal(linked.resolvedInquiry.content,'fixture');assert.ok(Array.isArray(linked.resolvedInquiry.policy_signal_categories));
    const only=await monitor('resolveOnly=true&inquiryId=1001');assert.deepEqual(only.data,[]);assert.equal(only.resolvedInquiry.id,'1001');
  }));
  await check('Monitor EXPLAIN exact RPC body: existing partial index used, no lateral history sort, no new index',()=>transaction(async()=>{
    await seed(75);await db.query(`INSERT INTO inquiry_messages(inquiry_id,sender_id,content,type,created_at) SELECT 1001,'${admin}','history',CASE WHEN n%10=0 THEN 'deleted' ELSE 'text' END,'2024-01-01'::timestamptz+n*interval '1 second' FROM generate_series(1,20000)n; ANALYZE inquiry_messages; ANALYZE inquiries;`);
    const body=(await db.query("SELECT prosrc FROM pg_proc WHERE proname='list_admin_monitor_recency'")).rows[0].prosrc.replaceAll('p_inquiry_ids','NULL::bigint[]').replaceAll('p_limit','100').replaceAll('p_offset','0');
    const plan=(await db.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+body)).rows[0]['QUERY PLAN'][0];const walk=node=>[node,...(node.Plans??[]).flatMap(walk)];const nodes=walk(plan.Plan);
    assert.ok(nodes.some(node=>node['Index Name']==='admin_chat_visible_message_recency'));const loop=nodes.find(node=>node['Index Name']==='admin_chat_visible_message_recency');assert.ok(loop['Actual Loops']>=75);
    const lateralLimits=nodes.filter(node=>node['Node Type']==='Limit'&&node['Actual Loops']>=75);assert.ok(lateralLimits.length>0);for(const limit of lateralLimits)assert.ok(!walk(limit).some(node=>node['Node Type']==='Sort'));
    console.log('MONITOR_EXPLAIN',JSON.stringify({postgres:17,executionMs:plan['Execution Time'],plan:plan.Plan}));
  }));
}
