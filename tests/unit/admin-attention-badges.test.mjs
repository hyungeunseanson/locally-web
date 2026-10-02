import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import * as dateFns from 'date-fns';
import { ko } from 'date-fns/locale';
import { sourceLoader, response, deferred, clientFixture, message } from './helpers/chatRuntime.mjs';
import { fixture, as, migration, guest, host, admin, whitelist } from './helpers/adminAttentionDatabase.mjs';

const phase2 = readFileSync('supabase/migrations/20261002041848_admin_attention_badges_phase_2.sql', 'utf8');
const { AdminAttentionStore, attentionTotals, EMPTY_ATTENTION } = sourceLoader()('app/utils/adminAttentionState.ts');
const activity = (id, surface = 'support', count = 1) => ({ inquiry_id: id, surface, admin_unread_count: count,
  last_message_id: '10', last_sender_role: surface === 'monitor' ? 'host' : 'customer', last_message_content: 'question',
  updated_at: '2026-10-02T00:00Z', last_message_at: '2026-10-02T00:00Z', needs_reply: surface !== 'monitor', reply_waiting_since: null });
const payload = rows => ({ success: true, data: { conversations: rows, adminAlertsUnread: 143, appsCount: 2, expsCount: 3, pendingBookingCount: 4, svcBankPendingCount: 5 } });

async function database() {
  const db = await fixture(); await db.exec(migration); await db.exec(phase2); return db;
}
test('rollout: historical general/NULL-type monitor is baselined exactly once; support/phone and participant receipts stay unchanged; later backdated guest/host inserts create one N until rendered ACK', async () => {
  const db = await fixture();
  try {
    await db.exec(migration);
    await db.exec(`INSERT INTO inquiries(id,user_id,host_id,type,status) VALUES(4,'${guest}','${host}',NULL,'open');
      INSERT INTO proxy_requests VALUES('phone','${guest}','{"linked_inquiry_id":"2"}');
      INSERT INTO inquiry_messages(id,inquiry_id,sender_id,content,type,is_read,read_at,created_at,admin_read_at) VALUES
        (10,1,'${guest}','historical guest','text',true,'2026-05-07T10:00Z','2026-05-07T09:00Z',NULL),
        (11,1,'${host}','historical host','text',false,NULL,'2026-09-20T09:00Z',NULL),
        (20,4,'${guest}','NULL inquiry type','text',true,'2026-09-01T12:00Z','2026-09-01T11:00Z',NULL),
        (21,4,'${host}','NULL message type',NULL,false,NULL,'2026-09-10T09:00Z',NULL),
        (22,4,'${admin}','admin','text',false,NULL,'2026-09-10T09:00Z',NULL),
        (23,4,'${whitelist}','whitelist admin','text',true,'2026-09-10T10:00Z','2026-09-10T09:00Z',NULL),
        (24,4,'${guest}','deleted','deleted',false,NULL,'2026-09-10T09:00Z',NULL),
        (25,4,'${host}','already seen','text',false,NULL,'2026-09-10T09:00Z','2026-09-11T09:00Z'),
        (30,2,'${guest}','phone unread','text',true,'2026-09-10T10:00Z','2026-09-10T09:00Z',NULL),
        (31,3,'${guest}','legacy support unread','text',false,NULL,'2026-09-10T09:00Z',NULL);`);
    const receipts = async () => (await db.query('SELECT id,is_read,read_at FROM inquiry_messages ORDER BY id')).rows;
    const excluded = async () => (await db.query('SELECT id,admin_read_at FROM inquiry_messages WHERE id IN (22,23,24,25,30,31) ORDER BY id')).rows;
    const marker = async () => (await db.query('SELECT * FROM private.admin_monitor_cutover')).rows;
    const unread = async () => (await db.query('SELECT get_admin_attention(NULL) AS rows')).rows[0].rows;
    const beforeReceipts = await receipts(), beforeExcluded = await excluded();
    await db.exec(phase2);
    const baseline = await marker();
    assert.equal(baseline.length,1);
    assert.equal(Number(baseline[0].messages),5);
    assert.equal(Number(baseline[0].conversations),2);
    assert.deepEqual(await receipts(),beforeReceipts,'all participant receipt columns exactly unchanged');
    assert.deepEqual(await excluded(),beforeExcluded,'support, phone, staff, deleted and prior admin-seen values preserved');
    const initial = await unread();
    assert.equal(initial.filter(row=>row.surface==='monitor').length,0);
    assert.deepEqual(initial.map(row=>[Number(row.inquiry_id),row.surface,Number(row.admin_unread_count)]),[[2,'phone',1],[3,'support',1]]);
    await db.exec(phase2);
    assert.deepEqual(await marker(),baseline,'immediate rerun preserves original cutover marker');
    assert.deepEqual(await receipts(),beforeReceipts);
    await db.exec(`INSERT INTO inquiry_messages(id,inquiry_id,sender_id,content,created_at) VALUES
      (9,4,'${guest}','new lower ID guest','2020-01-01T00:00Z'),(41,4,'${host}','new host','2020-01-01T00:00Z');`);
    assert.deepEqual(attentionTotals({ ...EMPTY_ATTENTION, conversations:Object.fromEntries((await unread()).map(row=>[row.inquiry_id,row])) }),{support:1,phone:1,monitor:1,total:3});
    const afterInsert = await receipts();
    await db.exec(phase2);
    assert.deepEqual(await marker(),baseline,'later rerun must not baseline new inserts, even with old created_at');
    assert.equal(Number((await unread()).find(row=>row.surface==='monitor').admin_unread_count),2);
    const ack = await as(db,'service_role',admin,'SELECT * FROM ack_admin_inquiry_snapshot(4,ARRAY[9,41]::bigint[])');
    assert.equal(Number(ack.rows[0].changed),2); assert.equal(Number(ack.rows[0].admin_unread_count),0);
    assert.equal((await unread()).filter(row=>row.surface==='monitor').length,0);
    assert.deepEqual(await receipts(),afterInsert);
    assert.deepEqual(await excluded(),beforeExcluded);
    for (const role of ['anon','authenticated']) for (const operation of ['SELECT','INSERT','UPDATE','DELETE']) {
      assert.equal((await db.query('SELECT has_table_privilege($1,$2,$3) allowed',[role,'private.admin_monitor_cutover',operation])).rows[0].allowed,false);
    }
    assert.equal((await db.query("SELECT has_table_privilege('service_role','private.admin_monitor_cutover','UPDATE') allowed")).rows[0].allowed,false);
    await db.exec(readFileSync('supabase/staging/admin-attention-target-contract.sql','utf8'));
  } finally { await db.close(); }
});
test('actual PostgreSQL: guest/host unseen, ten messages one conversation, all admins/deleted excluded; exact rendered ACK preserves late higher/lower IDs and participant receipts', async () => {
  const db = await database();
  try {
    await db.exec(phase2); // idempotent migration
    await db.exec(`INSERT INTO inquiry_messages(id,inquiry_id,sender_id,content,type) VALUES
      (10,1,'${guest}','guest','text'), (11,1,'${host}','host','text'),
      (12,1,'${admin}','staff','text'), (13,1,'${whitelist}','other staff','text'), (14,1,'${guest}','hidden','deleted');`);
    const read = async () => (await db.query('SELECT get_admin_attention(NULL) AS rows')).rows[0].rows;
    assert.equal((await read())[0].admin_unread_count, 2); // initial host history is the cutover baseline
    const before = (await db.query('SELECT id,is_read,read_at FROM inquiry_messages ORDER BY id')).rows;
    const ack = await as(db, 'service_role', admin, 'SELECT * FROM ack_admin_inquiry_snapshot(1, ARRAY[1,10]::bigint[])');
    assert.equal(Number(ack.rows[0].admin_unread_count), 1, 'message 11 remains unseen');
    await db.exec(`INSERT INTO inquiry_messages(id,inquiry_id,sender_id,content) VALUES (9,1,'${guest}','late lower ID');`);
    await as(db, 'service_role', admin, 'SELECT * FROM ack_admin_inquiry_snapshot(1, ARRAY[1,10]::bigint[])');
    assert.equal(Number((await read())[0].admin_unread_count), 2, 'late ID 9 was not rendered or acknowledged');
    assert.deepEqual((await db.query('SELECT id,is_read,read_at FROM inquiry_messages WHERE id <> 9 ORDER BY id')).rows, before);
    await as(db, 'service_role', admin, 'SELECT * FROM ack_admin_inquiry_snapshot(1, ARRAY[9,11]::bigint[])');
    assert.equal((await read()).length, 0, 'staff and deleted rows never create N');
    for (const fn of ['get_admin_attention(bigint[])', 'ack_admin_inquiry_snapshot(bigint,bigint[])']) for (const role of ['anon','authenticated']) {
      assert.equal((await db.query('SELECT has_function_privilege($1,$2,\'EXECUTE\') allowed', [role,fn])).rows[0].allowed, false);
    }
    for (const actor of [guest, host]) await assert.rejects(as(db, 'authenticated', actor, "UPDATE inquiry_messages SET sender_id=$1, content='tamper' WHERE id=10", [admin]), /permission denied/);
    await assert.rejects(as(db, 'service_role', admin, 'SELECT * FROM ack_admin_inquiry_snapshot(2, ARRAY[10]::bigint[])'), /Invalid/);
    await db.exec(readFileSync('supabase/staging/admin-attention-target-contract.sql','utf8'));
  } finally { await db.close(); }
});

test('DB/API truth: valid phone is distinct, anchors/duplicate/wrong-user links fail closed; list/sidebar/phone share activity', async () => {
  const db = await database();
  try {
    await db.exec(`INSERT INTO proxy_requests VALUES ('phone','${guest}','{"linked_inquiry_id":"2"}');
      INSERT INTO inquiry_messages(inquiry_id,sender_id,content) SELECT 2,'${guest}','question' FROM generate_series(1,10);
      INSERT INTO inquiry_messages(inquiry_id,sender_id,content) VALUES(3,'${guest}','legacy'),(1,'${host}','new monitor');`);
    const rpc = async (name, args) => {
      const statement = name === 'get_admin_attention' ? 'SELECT get_admin_attention($1::bigint[]) result' : 'SELECT * FROM get_admin_inquiry_activity($1::bigint[])';
      const rows = (await db.query(statement,[args.p_inquiry_ids])).rows;
      return { data: name === 'get_admin_attention' ? rows[0].result : rows };
    };
    const build = sourceLoader({ 'server-only': {} })('app/api/admin/customer-support/queries.ts');
    const dbRows = (await rpc('get_admin_attention',{p_inquiry_ids:null})).data;
    assert.deepEqual(attentionTotals({ ...EMPTY_ATTENTION, conversations: Object.fromEntries(dbRows.map(row => [String(row.inquiry_id),row])) }), { support:1,phone:1,monitor:1,total:3 });
    const { queryBuilder } = await import('./helpers/chatRuntime.mjs');
    let actor = admin;
    const operations = [];
    const client = { rpc: async (name,args) => { operations.push({rpc:name,args}); return rpc(name,args); }, from: table => queryBuilder(table, async state => {
      operations.push({table,state});
      if (table === 'users') return { data:(await db.query('SELECT role FROM users WHERE id=$1',[actor])).rows[0] ?? null };
      if (table === 'admin_whitelist') return { data:null };
      if (table === 'profiles' || table === 'host_applications' || table === 'experiences' || table === 'bookings' || table === 'service_bookings' || table === 'notifications') return { data:[], count:table === 'notifications' ? 143 : 0 };
      if (table === 'inquiries') {
        let rows=(await db.query('SELECT * FROM inquiries ORDER BY id')).rows;
        for (const [method,column,value] of state.filters) {
          if (method==='in') rows=rows.filter(row=>value.map(String).includes(String(row[column])));
          if (method==='or' && column.includes('type.not.in')) rows=rows.filter(row=>!['admin','admin_support'].includes(row.type));
        }
        return {data:await Promise.all(rows.map(async row=>({...row,experiences:null,inquiry_messages:(await db.query("SELECT * FROM inquiry_messages WHERE inquiry_id=$1 AND type IS DISTINCT FROM 'deleted' ORDER BY id DESC LIMIT 1",[row.id])).rows})))};
      }
      if (table === 'proxy_requests') return { data:(await db.query("SELECT * FROM proxy_requests WHERE form_data->>'__proxy_card_anchor' IS DISTINCT FROM 'v1'")).rows
        .filter(row=>state.filters.every(([method,column,value])=>method!=='in'||column!=='form_data->>linked_inquiry_id'||value.includes(row.form_data.linked_inquiry_id)))
        .map(row=>({...row,status:'COMPLETED',payment_status:'COMPLETED',category:'RESTAURANT'})) };
      throw new Error(table);
    }) };
    const load = sourceLoader({ 'server-only':{}, 'next/server':{NextResponse:{json:(body,init)=>response(body,init?.status||200)}},
      '@/app/utils/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:actor?{id:actor}:null}})}})}, '@/app/utils/supabase/admin':{createAdminClient:()=>client} });
    const sidebar = await load('app/api/admin/sidebar-counts/route.ts').GET(new Request('http://local/api/admin/sidebar-counts'));
    const body = await sidebar.json(); assert.equal(body.data.csUnreadCount,3); assert.deepEqual(body.data.csUnseenByView,{support:1,phone:1,monitor:1,total:3}); assert.equal(body.data.adminAlertsUnread,143);
    const lists=load('app/api/admin/inquiries/route.ts');
    const support=(await (await lists.GET(new Request('http://local/api/admin/inquiries?view=support'))).json()).data;
    const monitor=(await (await lists.GET(new Request('http://local/api/admin/inquiries?view=monitor'))).json()).data;
    assert.deepEqual(support.map(row=>Number(row.id)),[3],'phone inquiry is excluded before support pagination');
    assert.deepEqual(monitor.map(row=>Number(row.id)),[1]);
    assert.equal(support[0].unread_count,dbRows.find(row=>Number(row.inquiry_id)===3).admin_unread_count);
    assert.equal(monitor[0].unread_count,dbRows.find(row=>Number(row.inquiry_id)===1).admin_unread_count);
    const callsBefore=operations.length;
    const phoneAPI=await load('app/api/admin/customer-support/route.ts').GET(new Request('http://local/api/admin/customer-support?filter=todo'));
    const phoneRows=(await phoneAPI.json()).data;
    assert.equal(phoneRows[0].admin_unread_count,10); assert.equal(phoneRows[0].needs_reply,true);
    assert.equal(operations.slice(callsBefore).filter(row=>row.rpc==='get_admin_inquiry_activity').length,1,'one batch activity query, no per-phone lookup');
    const phone = await build.enrichPhoneRequests(client,[{id:'phone',user_id:guest,form_data:{linked_inquiry_id:'2'},status:'COMPLETED',payment_status:'COMPLETED'}]);
    assert.equal(phone[0].admin_unread_count,dbRows.find(row=>Number(row.inquiry_id)===2).admin_unread_count);
    assert.equal(phone[0].admin_unread_count,10); assert.equal(body.data.csUnseenByView.phone,1);
    await db.exec(`INSERT INTO proxy_requests VALUES('duplicate','${guest}','{"linked_inquiry_id":"2"}');`);
    const duplicate = (await rpc('get_admin_attention',{p_inquiry_ids:[2]})).data[0]; assert.equal(duplicate.surface,'support');
    await db.exec("DELETE FROM proxy_requests WHERE id='duplicate'");
    await db.exec(`UPDATE proxy_requests SET form_data='{"linked_inquiry_id":"2","__proxy_card_anchor":"v1"}' WHERE id='phone'`);
    assert.equal((await rpc('get_admin_attention',{p_inquiry_ids:[2]})).data[0].surface,'support');
    const countRoute=load('app/api/admin/sidebar-counts/route.ts');
    for (const user of [guest,host]) { actor=user; assert.equal((await countRoute.GET(new Request('http://local/api/admin/sidebar-counts'))).status,403); }
    actor=null; assert.equal((await countRoute.GET(new Request('http://local/api/admin/sidebar-counts'))).status,401);
    await db.exec(`UPDATE proxy_requests SET user_id='${host}',form_data='{"linked_inquiry_id":"2"}' WHERE id='phone'`);
    assert.equal((await rpc('get_admin_attention',{p_inquiry_ids:[2]})).data[0].surface,'support');
  } finally { await db.close(); }
});

test('store: stale full GET cannot erase a newer N; stale ACK cannot clear a concurrent message; failed catch-up preserves previous counts', async () => {
  const f = clientFixture();
  const gate = deferred(); let requests = 0;
  const store = new AdminAttentionStore(async () => {
    requests++;
    if (requests === 1) return gate.promise;
    return response(payload([activity(1)]));
  });
  try {
    const running=store.refresh(); store.changed(1); gate.resolve(response(payload([]))); await running;
    assert.equal(attentionTotals(store.getSnapshot()).total,1);
    const version=store.version('1'); store.changed(1); store.applyAcknowledgement('1',0,version);
    assert.equal(attentionTotals(store.getSnapshot()).total,1);
    await f.timers(250);
    store.applyAcknowledgement('1',0,store.version('1')); assert.equal(attentionTotals(store.getSnapshot()).total,0);
    const broken=new AdminAttentionStore(async()=>response({success:false},500)); await broken.refresh(); assert.equal(broken.getSnapshot().ready,false); assert.ok(broken.getSnapshot().error);
    broken.stop();
  } finally { store.stop(); await f.dispose(); }
});

test('queued successful-action refresh survives an older failed full GET and stays serialized', async () => {
  const gate=deferred();let requests=0,active=0,maxActive=0;
  const store=new AdminAttentionStore(async()=>{
    active++;maxActive=Math.max(active,maxActive);requests++;
    try {if(requests===2)return await gate.promise;
      return response({...payload([]),data:{...payload([]).data,pendingBookingCount:requests===1?1:0}});
    } finally {active--;}
  });
  try {
    await store.refresh();
    const old=store.refresh();await store.refresh();
    assert.equal(requests,2,'queued mutation refresh does not run in parallel');
    gate.resolve(response({success:false},500));await old;
    assert.equal(requests,3,'explicit trailing request survives older catch-up failure');
    assert.equal(store.getSnapshot().pendingBookingCount,0);assert.equal(store.getSnapshot().error,null);
    assert.equal(maxActive,1);
  } finally {store.stop();}
});

for (const kind of ['approvals','ledger','service']) test(`action freshness: actual ${kind} success immediately refreshes shared badge; rejection leaves count; no timer or thread GET`, async () => {
  const counts={appsCount:1,expsCount:1,pendingBookingCount:1,svcBankPendingCount:1};
  const countCalls=[]; let fail=true;
  const store=new AdminAttentionStore(async url=>{countCalls.push(url);return response({...payload([]),data:{...payload([]).data,...counts}});});
  const booking={id:'bank-booking',order_id:'bank-order',customer_id:'guest',status:'PENDING',payment_method:'bank',amount:10000,
    created_at:'2026-10-01T00:00Z',date:'2026-10-10',time:'10:00',guests:1,_type:'experience',payout_status:'pending',
    profiles:{full_name:'Guest',email:'guest@example.invalid'},experiences:{title:'Bank fixture',profiles:{name:'Host'}},
    service_request:{title:'Service fixture',status:'pending_payment'},refund_operations:[]};
  const mutate=()=>{
    if(fail) return response({success:false,error:'rejected'},409);
    if(kind==='ledger')counts.pendingBookingCount=0;
    if(kind==='service')counts.svcBankPendingCount=0;
    return response({success:true});
  };
  const f=clientFixture({additionalStubs:{
    '../components/AdminAttentionProvider':{useAdminAttention:()=>store}, './AdminAttentionProvider':{useAdminAttention:()=>store},
    '@/app/actions/admin':{updateAdminStatus:async(table)=>{if(fail)throw new Error('rejected');counts[table==='experiences'?'expsCount':'appsCount']=0;}},
    'date-fns':dateFns,'date-fns/locale':{ko},'next/dynamic':{default:()=>()=>null},
    'react-date-range/dist/styles.css':{},'react-date-range/dist/theme/default.css':{},
    '@/app/utils/adminBadgeState':{markAdminBookingViewed:()=>false},
    '@/app/hooks/useConfirmDialog':{useConfirmDialog:()=>({requestConfirm:(_,action)=>action(),ConfirmDialogElement:null})},
  }});
  try {
    f.request=async(url)=>{
      if(url==='/api/admin/bookings/confirm-payment'||url==='/api/admin/service-confirm-payment')return mutate();
      if(url==='/api/admin/master-ledger')return response({success:true,data:[booking]});
      if(url==='/api/admin/service-bookings')return response({success:true,data:[booking]});
      if(url==='/api/admin/host-applications'||url==='/api/admin/experiences')return response({data:[]});
      throw new Error(`Unexpected action fixture request ${url}`);
    };
    await store.refresh();
    const useApprovals=kind==='approvals'?f.load('app/admin/dashboard/hooks/useAdminApprovalsData.ts').useAdminApprovalsData:null;
    const Component=kind==='ledger'?f.load('app/admin/dashboard/components/MasterLedgerTab.tsx').default:
      kind==='service'?f.load('app/admin/dashboard/components/ServiceAdminTab.tsx').default:null;
    function ApprovalsProbe(){const value=useApprovals();return React.createElement('button',{id:'approve',onClick:()=>value.updateStatus('host_applications',1,'approved')},'Approve');}
    function Probe(){const snapshot=React.useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);
      return React.createElement('div',null,React.createElement('output',{id:'badge'},JSON.stringify([snapshot.appsCount,snapshot.expsCount,snapshot.pendingBookingCount,snapshot.svcBankPendingCount])),React.createElement(Component||ApprovalsProbe));}
    await f.mount(Probe);
    const click=async(node)=>{assert.ok(node,'actual action must be rendered');await f.flush(()=>node.dispatchEvent(new f.dom.window.MouseEvent('click',{bubbles:true})));};
    const action=async()=>{
      if(kind==='approvals')await click(f.dom.window.document.getElementById('approve'));
      else if(kind==='service')await click([...f.dom.window.document.querySelectorAll('button')].find(node=>node.textContent.includes('💰 입금 확인')));
      else {
        if(!f.dom.window.document.querySelector('[data-testid="admin-master-ledger-confirm-payment-action"]'))await click(f.dom.window.document.querySelector('tbody tr'));
        if(!f.dom.window.document.querySelector('[data-testid="admin-master-ledger-confirm-dialog-desktop-confirm"]'))await click(f.dom.window.document.querySelector('[data-testid="admin-master-ledger-confirm-payment-action"]'));
        await click(f.dom.window.document.querySelector('[data-testid="admin-master-ledger-confirm-dialog-desktop-confirm"]'));
      }
    };
    await action();assert.equal(countCalls.length,1,'rejected action must not refresh or decrement');
    assert.equal(f.dom.window.document.getElementById('badge').textContent,'[1,1,1,1]');
    fail=false;await action();
    assert.equal(countCalls.length,2,'success immediately issues one shared full refresh');
    assert.equal(f.dom.window.document.getElementById('badge').textContent,kind==='approvals'?'[0,1,1,1]':kind==='ledger'?'[1,1,0,1]':'[1,1,1,0]');
    assert.equal(f.calls.requests.some(row=>row.url.endsWith('/messages')),false,'action refresh never fetches a thread');
  } finally {store.stop();await f.dispose();}
});

test('ACK runs after committed rendered snapshot; failure keeps N; same successful IDs are acknowledged once and newer message IDs survive old ACK', async () => {
  const f=clientFixture({role:'admin'}); const gate=deferred(); const store=new AdminAttentionStore(async()=>response(payload([activity(1)])));
  try {
    await store.refresh();
    const toast = { showToast() {} };
    // Share the real context through a narrow injectable hook at the I/O boundary.
    const load=sourceLoader({ '@/app/utils/supabase/client':{createClient:()=>({auth:{getUser:f.auth},channel:()=>{const c={on:()=>c,subscribe:()=>c};return c;},removeChannel(){}})},
      '@/app/context/ToastContext':{useToast:()=>toast}, '../components/AdminAttentionProvider':{useAdminAttention:()=>store},
      '@/app/utils/privateStorageDelivery':{getPrivateChatImageDeliveryUrl:()=>null} });
    const useQuery=load('app/admin/dashboard/hooks/useAdminChatQuery.ts').useAdminChatQuery;
    const state={current:null}; let fail=true; let renderedAtAck=false; const original=f.request;
    f.request=async(url,options)=> {
      if(url.endsWith('/messages')) return response({success:true,data:[message(10,1,'guest')],inquiry:{...f.rows[0],admin_unread_count:1}});
      if(url.endsWith('/ack')) { renderedAtAck=Boolean(f.dom.window.document.querySelector('[data-rendered="10"]')); return fail ? response({success:false},500) : gate.promise; }
      return original(url,options);
    };
    function Probe(){ const value=useQuery(); React.useEffect(()=>{state.current=value;}); return React.createElement('div',null,value.messages.map(row=>React.createElement('p',{key:row.id,'data-rendered':row.id},row.content))); }
    await f.mount(Probe); await f.flush(()=>state.current.selectInquiry(1)); assert.equal(renderedAtAck,true); assert.equal(attentionTotals(store.getSnapshot()).total,1);
    fail=false; await f.flush(()=>state.current.loadMessages(1)); store.changed(1);
    await f.flush(()=>gate.resolve(response({success:true,admin_unread_count:0}))); assert.equal(attentionTotals(store.getSnapshot()).total,1,'old successful ACK does not clear new event');
    const count=f.calls.requests.filter(row=>row.url.endsWith('/ack')).length;
    await f.flush(()=>state.current.loadMessages(1)); assert.equal(f.calls.requests.filter(row=>row.url.endsWith('/ack')).length,count,'successful same snapshot is cached');
    assert.deepEqual(JSON.parse(f.calls.requests.find(row=>row.url.endsWith('/ack')).options.body).messageIds,['10']);
    assert.equal(f.calls.requests.some(row=>row.url==='/api/inquiries/read'),false);
  } finally { store.stop(); await f.dispose(); }
});
