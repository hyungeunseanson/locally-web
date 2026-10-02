import assert from 'node:assert/strict';
import test from 'node:test';
import { sourceLoader, queryBuilder, inquiry, response } from './helpers/chatRuntime.mjs';
const requestId='aaaaaaaa-aaaa-4aaa-8aaa-000000000010';
function fixture({user={id:'admin'}, allowed=true, rpcError=null}={}) {
  const calls=[],queries=[],background=[];
  const db={rpc:async(name,args)=>{calls.push({name,args});return {data:rpcError?null:{status:'COMPLETED',handledMessageIds:['100'],needsReply:true,hasMoreUnhandled:true,id:'999',created_at:'2026-10-02T10:00:00Z'},error:rpcError};},
    from:table=>queryBuilder(table,state=>{queries.push(state);
      if(table==='inquiries')return {data:inquiry(1,'admin_support')};
      if(table==='users')return {data:{role:'admin'}};
      if(table==='profiles')return {data:{full_name:'fixture'}};
      if(table==='inquiry_messages')return {data:{id:999,created_at:'2026-10-02T10:00:00Z'}};
      if(table==='proxy_requests')return {data:{id:requestId,status:'PENDING',payment_status:'COMPLETED',form_data:{linked_inquiry_id:'1'}}};
      return {data:[]};
    })};
  const load=sourceLoader({
    'server-only':{},'next/server':{NextResponse:{json:(body,init)=>response(body,init?.status??200)},after:fn=>background.push(fn)},
    '@/app/utils/supabase/server':{createClient:async()=>({...db,auth:{getUser:async()=>({data:{user}})}})},
    '@/app/utils/supabase/admin':{createAdminClient:()=>db,recordAuditLog:async()=>{}},
    '@/app/utils/adminAccess':{resolveAdminAccess:async()=>({isAdmin:allowed})},
    '@/app/utils/adminSupportUnreadAlerts':{clearAdminSupportUnreadBatch:async()=>{},startOrAdvanceAdminSupportUnreadBatch:async()=>{}},
    '@/app/utils/adminAlertCenter':{insertAdminAlerts:async()=>{},sendAdminAlertEmails:async()=>{}},
    '@/app/emails/delivery/sendTemplatedEmail':{sendTemplatedEmail:async()=>({sent:true})},
  });
  const complete=body=>load('app/api/admin/proxy-bookings/[id]/complete/route.ts').POST({json:async()=>body},{params:Promise.resolve({id:requestId})});
  return {calls,queries,background,load,complete};
}
test('canonical completion uses verified actor and one RPC; concurrent pending true is preserved',async()=>{
  const f=fixture();const result=await f.complete({inquiryId:'1',seenCustomerMessageIds:['100'],adminId:'attacker'});
  assert.equal(result.status,200);assert.equal((await result.json()).needsReply,true);
  assert.deepEqual(f.calls,[{name:'complete_phone_request',args:{p_request_id:requestId,p_inquiry_id:'1',p_message_ids:['100'],p_admin_id:'admin'}}]);assert.equal(f.queries.length,0);
});
test('auth, malformed/bigint/empty/duplicate snapshots and RPC conflicts fail without alternate writes',async()=>{
  for(const [options,status] of [[{user:null},401],[{allowed:false},403]]){const f=fixture(options);assert.equal((await f.complete({inquiryId:'1',seenCustomerMessageIds:['100']})).status,status);assert.equal(f.calls.length,0);}
  for(const ids of [undefined,[],['100','100'],['0'],['-1'],['9223372036854775808'],[100],Array(201).fill('100')]){
    const f=fixture();assert.equal((await f.complete({inquiryId:'1',seenCustomerMessageIds:ids})).status,400);assert.equal(f.calls.length,0);
  }
  for(const [code,status] of [['22023',409],['P0001',409],['42501',403],['XX000',500]]){
    const f=fixture({rpcError:{code}});assert.equal((await f.complete({inquiryId:'1',seenCustomerMessageIds:['100']})).status,status);assert.equal(f.calls.length,1);assert.equal(f.queries.length,0);
  }
});
test('phone reply uses transactional RPC instead of direct INSERT, preserves canonical ACK and post-save pipeline',async()=>{
  const f=fixture();const result=await f.load('app/api/inquiries/thread/shared.ts').createInquiryMessage({actor:{id:'admin'},body:{inquiryId:'1',content:'reply',phoneFollowup:{proxyRequestId:requestId,seenCustomerMessageIds:['100']}}});
  assert.equal(result.messageId,'999');assert.equal(result.message.is_read,false);assert.equal(result.message.read_at,null);
  assert.equal(f.calls[0].name,'reply_phone_request');assert.equal(f.calls[0].args.p_admin_id,'admin');
  assert.ok(!f.queries.some(q=>q.table==='inquiry_messages'&&q.operation==='insert'));assert.equal(f.background.length,1);
});
test('phone reply RPC failure never falls back, reports success or dispatches post-save effects',async()=>{
  const f=fixture({rpcError:{code:'22023'}});
  await assert.rejects(f.load('app/api/inquiries/thread/shared.ts').createInquiryMessage({actor:{id:'admin'},body:{inquiryId:'1',content:'reply',phoneFollowup:{proxyRequestId:requestId,seenCustomerMessageIds:['100']}}}),error=>error.status===500);
  assert.equal(f.calls.length,1);assert.equal(f.background.length,0);assert.ok(!f.queries.some(q=>q.operation==='insert'||q.operation==='update'));
});
test('legacy reply retains normal send path without handling; legacy completion PATCH cannot bypass snapshot',async()=>{
  const f=fixture();await f.load('app/api/inquiries/thread/shared.ts').createInquiryMessage({actor:{id:'admin'},body:{inquiryId:'1',content:'legacy'}});
  assert.equal(f.calls.length,0);assert.ok(f.queries.some(q=>q.table==='inquiry_messages'&&q.operation==='insert'));
  const patch=fixture();const result=await patch.load('app/api/proxy-bookings/[id]/route.ts').PATCH({json:async()=>({status:'COMPLETED'})},{params:Promise.resolve({id:requestId})});
  assert.equal(result.status,409);assert.ok(!patch.queries.some(q=>q.operation==='update'));
});
