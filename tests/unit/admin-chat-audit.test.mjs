import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { clientFixture, inquiry, message, response, deferred, sourceLoader, queryBuilder } from './helpers/chatRuntime.mjs';

const hook = 'app/admin/dashboard/hooks/useAdminChatQuery.ts';
const sources = process.env.ADMIN_AUDIT_BASELINE ? { [resolve(hook)]: execFileSync('git', ['show', `da69a033:${hook}`], { encoding: 'utf8' }) } : {};
async function fixture(rows = [inquiry(1, 'admin_support')]) {
  const f = clientFixture({ sources, rows });
  f.auth = async () => ({ data: { user: { id: 'admin' } } });
  const useChat = f.load(hook).useAdminChatQuery;
  let chat;
  function Probe() { const value = useChat(); React.useEffect(() => { chat = value; }); return React.createElement('p', null, value.messages.map(row => row.content).join(',')); }
  await f.mount(Probe);
  await f.flush(() => chat.selectInquiry(1));
  return Object.assign(f, { chat: () => chat, emit: (event, row) => f.flush(() => {
    for (const channel of f.calls.channels.filter(c => !f.calls.removed.includes(c))) for (const [, filter, cb] of channel.handlers) {
      if (filter.table === 'inquiry_messages' && [event, '*'].includes(filter.event)) cb({ eventType: event, new: event === 'DELETE' ? {} : row, old: event === 'DELETE' ? row : {} });
    }
  }) });
}
test('same admin sends from another tab: canonical INSERT renders once without a thread GET and preserves receipts', async () => {
  const f = await fixture();
  try {
    const gets = f.calls.requests.filter(r => r.url.endsWith('/messages')).length;
    const row = message(99, 1, 'admin', 'another tab reply');
    await f.emit('INSERT', row); await f.emit('INSERT', row); await f.timers(250);
    assert.equal(f.chat().messages.filter(m => m.id === 99).length, 1);
    assert.equal(f.chat().messages.find(m => m.id === 99).is_read, false);
    await f.emit('UPDATE', { ...row, type: 'deleted', admin_read_at: '2026-10-02T11:00Z' });
    await f.emit('INSERT', row);
    assert.equal(f.chat().messages.find(m => m.id === 99).type, 'deleted', 'late duplicate INSERT cannot resurrect a moderated row');
    assert.equal(f.calls.requests.filter(r => r.url.endsWith('/messages')).length, gets);
  } finally { await f.dispose(); }
});
test('PK-only DELETE during GET removes a row and a stale snapshot cannot resurrect it', async () => {
  const f = await fixture();
  try {
    const gate = deferred(); f.request = () => gate.promise;
    await f.flush(() => { void f.chat().loadMessages(1); });
    await f.emit('DELETE', { id: 10 });
    assert.equal(f.chat().messages.length, 0);
    await f.flush(() => gate.resolve(response({ success: true, data: [message(10, 1)], inquiry: f.rows[0] })));
    assert.equal(f.chat().messages.length, 0);
    assert.equal(f.calls.requests.filter(r => r.url === '/api/inquiries/read').length, 0);
  } finally { await f.dispose(); }
});
test('empty thread catch-up failure remains recoverable with a visible error', async () => {
  const f = await fixture();
  try {
    f.request = async () => response({ success: true, data: [], inquiry: f.rows[0] });
    await f.flush(() => f.chat().loadMessages(1));
    f.request = async () => response({ success: false }, 500);
    await f.flush(() => f.chat().loadMessages(1));
    assert.match(f.chat().messageError, /다시 시도/);
    assert.equal(f.chat().isMessagesLoading, false);
  } finally { await f.dispose(); }
});
test('moderation deletion never marks participant receipts read', async () => {
  const writes = [];
  const db = { from: table => queryBuilder(table, state => {
    if (state.operation === 'update') { writes.push(state); return { data: [] }; }
    if (table === 'inquiries') return { data: { id: 1, type: 'general', content: 'body' } };
    return { data: { ...message(10, 1), read_at: null, is_read: false } };
  }) };
  const routePath = 'app/api/admin/inquiries/messages/[messageId]/route.ts';
  const routeSources = process.env.ADMIN_AUDIT_BASELINE ? { [resolve(routePath)]: execFileSync('git', ['show', `da69a033:${routePath}`], { encoding: 'utf8' }) } : {};
  const load = sourceLoader({
    'next/server': { NextResponse: { json: (body, init) => response(body, init?.status ?? 200) } },
    '@/app/utils/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'admin' } } }) } }) },
    '@/app/utils/supabase/admin': { createAdminClient: () => db, recordAuditLog: async () => {} },
    '@/app/utils/adminAccess': { resolveAdminAccess: async () => ({ isAdmin: true }) },
  }, routeSources);
  const result = await load(routePath).PATCH({ json: async () => ({ action: 'soft_delete', inquiryId: '1' }) }, { params: Promise.resolve({ messageId: '10' }) });
  assert.equal(result.status, 200);
  const body = writes.find(w => w.table === 'inquiry_messages').body;
  assert.equal(body.type, 'deleted');
  assert.equal(Object.hasOwn(body, 'is_read'), false);
  assert.equal(Object.hasOwn(body, 'read_at'), false);
});

test('status filter is applied before server pagination; invalid IDs fail with 400', async () => {
  const queries=[];
  const db={from:table=>queryBuilder(table,state=>{queries.push(state);return {data:[]};}),rpc:async(name,args)=>{queries.push({rpc:name,args});return {data:[]};}};
  const load=sourceLoader({'server-only':{},'next/server':{NextResponse:{json:(body,init)=>response(body,init?.status??200)}},
    '@/app/utils/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'admin'}}})}})},
    '@/app/utils/supabase/admin':{createAdminClient:()=>db},
    '@/app/utils/adminAccess':{resolveAdminAccess:async()=>({isAdmin:true})},
  });
  const {GET}=load('app/api/admin/inquiries/route.ts');
  for(const status of ['open','resolved','in_progress']) {
    queries.length=0;
    assert.equal((await GET(new Request(`http://local/api/admin/inquiries?view=support&status=${status}&offset=50`))).status,200);
    const query=queries.find(q=>q.rpc==='list_admin_support_recency');
    assert.equal(query.args.p_status,status);
    assert.equal(query.args.p_offset,0,'response offset is applied only after operational filters');
  }
  for(const query of ['inquiryId=abc','inquiryId=-1','status=unknown']) {
    queries.length=0; assert.equal((await GET(new Request(`http://local/api/admin/inquiries?${query}`))).status,400);
    assert.equal(queries.length,0);
  }
});

test('a hidden admin tab never acknowledges a newly loaded unseen snapshot', async () => {
  const f=await fixture();
  try {
    Object.defineProperty(f.dom.window.document,'visibilityState',{configurable:true,value:'hidden'});
    f.request=async url=>url.endsWith('/ack')?response({success:true,admin_unread_count:0}):response({success:true,inquiry:{...f.rows[0],admin_unread_count:1},data:[message(11,1,'guest')]});
    await f.flush(()=>f.chat().loadMessages(1));
    assert.equal(f.calls.requests.filter(row=>row.url.endsWith('/ack')).length,0);
    Object.defineProperty(f.dom.window.document,'visibilityState',{configurable:true,value:'visible'});
    await f.flush(()=>f.chat().loadMessages(1));
    assert.equal(f.calls.requests.filter(row=>row.url.endsWith('/ack')).length,1);
  }finally{await f.dispose();}
});


test('late ACK failure for A cannot erase B acknowledgement retry after A→B', async () => {
  const f = await fixture([inquiry(1, 'admin_support'), inquiry(2, 'admin_support')]);
  try {
    const a = deferred(), b = deferred();
    f.request = async url => {
      const id = Number(url.match(/inquiries\/(\d+)/)?.[1]);
      if (url.endsWith('/ack')) return (id === 1 ? a : b).promise;
      return response({ success: true, inquiry: { ...f.rows.find(row => row.id === id), admin_unread_count: 1 }, data: [message(id * 10 + 1, id, 'guest')] });
    };
    await f.flush(() => f.chat().loadMessages(1));
    await f.flush(() => f.chat().selectInquiry(2));
    await f.flush(() => b.resolve(response({ success: false }, 500)));
    assert.equal(f.chat().acknowledgementFailed, true);
    await f.flush(() => a.resolve(response({ success: false }, 500)));
    assert.equal(f.chat().selectedInquiry.id, 2);
    assert.equal(f.chat().acknowledgementFailed, true, 'old conversation failure cannot replace the selected failure');
  } finally { await f.dispose(); }
});
