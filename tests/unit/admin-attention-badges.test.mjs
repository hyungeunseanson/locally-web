import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
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
test('actual PostgreSQL: guest/host unseen, ten messages one conversation, all admins/deleted excluded; exact rendered ACK preserves late higher/lower IDs and participant receipts', async () => {
  const db = await database();
  try {
    await db.exec(phase2); // idempotent migration
    await db.exec(`INSERT INTO inquiry_messages(id,inquiry_id,sender_id,content,type) VALUES
      (10,1,'${guest}','guest','text'), (11,1,'${host}','host','text'),
      (12,1,'${admin}','staff','text'), (13,1,'${whitelist}','other staff','text'), (14,1,'${guest}','hidden','deleted');`);
    const read = async () => (await db.query('SELECT get_admin_attention(NULL) AS rows')).rows[0].rows;
    assert.equal((await read())[0].admin_unread_count, 3); // includes initial host message id=1
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
      INSERT INTO inquiry_messages(inquiry_id,sender_id,content) VALUES(3,'${guest}','legacy');`);
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
