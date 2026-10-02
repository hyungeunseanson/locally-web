import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { sourceLoader, queryBuilder, clientFixture, inquiry, message, response } from './helpers/chatRuntime.mjs';

const hook='app/admin/dashboard/hooks/useAdminChatQuery.ts', listPath='app/api/admin/inquiries/route.ts';
const beforeHook=readFileSync('tests/fixtures/admin-attention-phase-2-before.txt','utf8');
const beforeList=readFileSync('tests/fixtures/admin-attention-phase-2-before-list.txt','utf8');
const auditedMainHook=execFileSync('git',['show',`da69a033:${hook}`],{encoding:'utf8'});
const auditedMainList=execFileSync('git',['show',`da69a033:${listPath}`],{encoding:'utf8'});
const hotfixHook=readFileSync('tests/fixtures/admin-attention-after-hotfix-before.txt','utf8');
// Preserve the first audit baseline and compare Phase 2 against hotfix main c7d37dab.
const baselineHashes = [createHash('sha256').update(beforeHook).digest('hex'),createHash('sha256').update(beforeList).digest('hex')];
assert.deepEqual(baselineHashes, ['570ef04c44522daab7502e80879cf6a14ba950df79e08db7bc5c9b66fa107203','27dd540b013f614f81f22f562afc5662e77bbb493fae5111ac357ddb73dfda1d']);
assert.equal(createHash('sha256').update(hotfixHook).digest('hex'),'1ebb1dc3618216214b3a30189d346cdc38ef5a9ecd062c2cbd04d7bf99cddef2');

function countedServer(before, auditedMain = false) {
  const calls=[]; const row={...inquiry(1,'admin_support'),guest:{name:'Customer'}};
  const server={ unread:0, messages:[message(10,1,'guest')], statuses:[] };
  const meta=()=>({inquiry_id:1,status:'open',updated_at:row.updated_at,last_sender_role:'customer',last_message_at:row.updated_at,
    last_message_content:'question',needs_reply:true,admin_unread_count:server.unread,surface:'support',last_message_id:String(server.messages.at(-1).id)});
  const client={
    from:table=>queryBuilder(table,state=>{
      calls.push({table,operation:state.operation});
      if(table==='users')return {data:{role:'admin'}};
      if(table==='admin_whitelist')return {data:null};
      if(table==='inquiries')return {data:state.filters.some(([,key])=>key==='id') ? row : [row]};
      if(table==='profiles')return {data:[{id:'guest',full_name:'Customer'}]};
      if(table==='inquiry_messages') return state.columns==='inquiry_id'?{data:[]} : state.columns==='id'?{data:[],count:0}:{data:server.messages};
      if(table==='admin_support_unread_alert_batches')return {data:state.operation==='update' ? [{inquiry_id:1}] : {inquiry_id:1,first_unread_message_id:null,first_unread_message_at:null,last_unread_message_id:null}};
      return {data:[],count:0};
    }),
    rpc:async(name,args)=>{
      calls.push({rpc:name});
      if(name==='get_admin_attention')return {data:server.unread>0||args.p_inquiry_ids ? [meta()] : []};
      if(name==='get_admin_inquiry_activity')return {data:[meta()]};
      if(name==='ack_admin_inquiry_snapshot'){server.unread=server.messages.filter(row=>!args.p_message_ids.includes(String(row.id))).length;return {data:[{changed:1,admin_unread_count:server.unread}]};}
      return {data:1};
    },
  };
  const load=sourceLoader({'server-only':{},'next/server':{NextResponse:{json:(body,init)=>response(body,init?.status||200)}},
    '@/app/utils/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'admin'}}})}})},
    '@/app/utils/supabase/admin':{createAdminClient:()=>client},
    '@/app/utils/adminAlertCenter':{insertAdminAlerts:async()=>{},sendAdminAlertEmails:async()=>{}},
    '@/app/utils/privateStorageDelivery':{getPrivateChatImageDeliveryUrl:id=>`/image/${id}`}
  },before?{[resolve(listPath)]:beforeList}:auditedMain?{[resolve(listPath)]:auditedMainList}:{});
  server.calls=calls;
  server.request=async(url,options)=>{
    const route=url.startsWith('/api/admin/sidebar-counts')?await load('app/api/admin/sidebar-counts/route.ts').GET(new Request(`http://local${url}`))
      :url.startsWith('/api/admin/inquiries?')?await load(listPath).GET(new Request(`http://local${url}`))
        :url.endsWith('/messages')?await load('app/api/admin/inquiries/[id]/messages/route.ts').GET({}, {params:Promise.resolve({id:'1'})})
          :await load('app/api/admin/inquiries/[id]/ack/route.ts').POST({json:async()=>JSON.parse(options.body)},{params:Promise.resolve({id:'1'})});
    server.statuses.push(route.status);assert.equal(route.status,200,url);return route;
  };
  return server;
}
async function measure(label, scenario) {
  const before=label==='legacy'||label==='hotfix';
  const server=countedServer(before,label==='auditedMain'); const f=clientFixture({sources:before?{[resolve(hook)]:label==='legacy'?beforeHook:hotfixHook}:label==='auditedMain'?{[resolve(hook)]:auditedMainHook}:{}});
  let active=0,maxActive=0,commits=0;
  f.auth=async()=>({data:{user:{id:'admin'}}}); f.request=async(...args)=>{maxActive=Math.max(maxActive,++active);try{return await server.request(...args);}finally{active--;}};
  const useQuery=f.load(hook).useAdminChatQuery;
  const Provider=f.load('app/admin/dashboard/components/AdminAttentionProvider.tsx').default;
  const state={current:null};
  function Probe(){const value=useQuery();React.useEffect(()=>{state.current=value;});return React.createElement('div',null,value.messages.map(row=>React.createElement('p',{key:row.id},row.content)));}
  function Root(){return React.createElement(React.Profiler,{id:'audit',onRender:()=>commits++},before?React.createElement(Probe):React.createElement(Provider,{userId:'admin'},React.createElement(Probe)));}
  try {
    await f.mount(Root); await f.flush(()=>state.current.selectInquiry(1));
    await f.flush(()=>{for(const channel of f.calls.channels) channel.status?.('SUBSCRIBED');});
    await f.timers(250);
    f.calls.requests.length=0;server.calls.length=0;maxActive=0;commits=0;
    if(scenario==='idle')await f.advanceTimers(600_000);
    else {
      const count=scenario==='single'?1:10;
      await f.flush(()=>{for(let i=0;i<count;i++){
        const row=message(11+i,1,'guest');server.messages.push(row);server.unread++;
        for (const channel of f.calls.channels) for (const [,filter,callback] of channel.handlers) {
          if (filter.table==='inquiry_messages' && ['INSERT','*'].includes(filter.event)) callback({eventType:'INSERT',new:row,old:{}});
        }
      }});
      await f.timers(250);
      // PostgreSQL also publishes each ACK's admin_read_at UPDATE. These receipt
      // events must reconcile counts without a list/thread fetch or another ACK.
      await f.flush(()=>{
        for(const row of server.messages.slice(1)) for(const channel of f.calls.channels) for(const [,filter,callback] of channel.handlers) {
          if(filter.table==='inquiry_messages' && ['UPDATE','*'].includes(filter.event)) callback({eventType:'UPDATE',new:{...row,admin_read_at:'2026-10-02T12:00Z'},old:{id:row.id}});
        }
      });
      await f.timers(250);
    }
    const requests=f.calls.requests;
    assert.ok(server.statuses.every(status=>status===200),'every measured route, including the actual ACK, succeeds');
    console.log(`ADMIN_AUDIT_RUNTIME ${JSON.stringify({label,scenario,maxConcurrentApi:maxActive,commits})}`);
    return { list:requests.filter(r=>r.url.startsWith('/api/admin/inquiries?')).length,
      thread:requests.filter(r=>r.url.endsWith('/messages')).length,
      aggregate:requests.filter(r=>r.url.startsWith('/api/admin/sidebar-counts')).length,
      ack:requests.filter(r=>r.url.endsWith('/ack')).length,api:requests.length,db:server.calls.length };
  } finally {await f.dispose();}
}
test('same actual-route fixture: idle ten minutes, one message, ten-message burst before/after; deltas coalesce and preserve existing safety fallback', async()=>{
  const results={baselineHashes};
  for(const scenario of ['idle','single','burst'])results[scenario]={legacy:await measure('legacy',scenario),before:await measure('hotfix',scenario),auditedMain:await measure('auditedMain',scenario),after:await measure('after',scenario)};
  console.log(`ADMIN_ATTENTION_PERFORMANCE ${JSON.stringify(results)}`);
  for(const scenario of ['idle','single','burst'])assert.deepEqual(results[scenario].auditedMain,results[scenario].after,'no request regression against starting main');
  assert.equal(results.idle.before.list,2); assert.equal(results.idle.after.list,2);
  assert.equal(results.idle.after.ack,0); assert.equal(results.single.after.list,0);
  assert.equal(results.single.after.thread,1); assert.equal(results.burst.after.list,0); assert.equal(results.burst.after.thread,1);
  assert.equal(results.burst.legacy.thread,10); assert.equal(results.burst.before.thread,2); assert.equal(results.burst.after.aggregate,2);
  assert.equal(results.burst.after.ack,1); assert.equal(results.burst.after.api,results.single.after.api);
  assert.deepEqual(results.idle.after,{list:2,thread:2,aggregate:2,ack:0,api:6,db:44});
  assert.deepEqual(results.single.after,{list:0,thread:1,aggregate:2,ack:1,api:4,db:18});
  assert.deepEqual(results.burst.after,results.single.after);
});
