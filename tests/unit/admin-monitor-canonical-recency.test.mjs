import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { sourceLoader, clientFixture, inquiry, message, response, deferred } from './helpers/chatRuntime.mjs';
const {compareCanonicalInquiries}=sourceLoader()('app/utils/adminCanonicalRecency.ts');
const time='2026-10-06T12:00:00Z',newTime='2026-10-06T12:30:00Z';
const row=(id,extra={})=>({...inquiry(id),created_at:'2025-01-01T00:00:00Z',canonical_activity_at:time,last_message_at:time,...extra});
async function fixture({rows=[row(1),row(2)],sources={},shared=true,deepLink=null}={}){
  let listener=()=>{},snapshot={conversations:{}},version=0;
  const attention={subscribe:fn=>{listener=fn;return()=>{};},version:()=>version,getSnapshot:()=>snapshot,ack:()=>{},applyAck:()=>{}};
  const f=clientFixture({role:'admin',rows,sources,additionalStubs:{'../components/AdminAttentionProvider':{useAdminAttention:()=>shared?attention:null},'./AdminAttentionProvider':{useAdminAttentionSnapshot:()=>null}}});
  f.auth=async()=>({data:{user:{id:'admin'}}});
  if(deepLink){f.dom.reconfigure({url:'http://localhost/?view=monitor&inquiryId='+deepLink});f.searchParams.set('inquiryId',String(deepLink));}
  const useQuery=f.load('app/admin/dashboard/hooks/useAdminChatQuery.ts').useAdminChatQuery;
  let state;function Probe(){const chat=useQuery({view:'monitor'});React.useEffect(()=>{state=chat;});return null;}
  const original=f.request;
  f.request=async(url,options)=>{
    if(url.endsWith('/ack'))return response({success:true,admin_unread_count:0});
    if(!url.startsWith('/api/admin/inquiries?'))return original(url,options);
    const params=new URL(url,'http://fixture.test').searchParams,offset=Number(params.get('offset'));
    return response({success:true,data:f.rows.slice().sort(compareCanonicalInquiries).slice(offset,offset+50).map(row=>({...row})),resolvedInquiry:deepLink?f.rows.find(row=>String(row.id)===String(deepLink)):null,pagination:{hasMore:f.rows.length>offset+50}});
  };
  await f.mount(Probe);
  return Object.assign(f,{chat:()=>state,emit:(event,record,table='inquiry_messages')=>f.flush(()=>{for(const channel of f.calls.channels)for(const [,filter,callback]of channel.handlers)if(filter.table===table&&filter.event===event)callback({new:event==='DELETE'?{}:record,old:event==='DELETE'?record:{},eventType:event});}),
    attentionUpdate:record=>f.flush(()=>{snapshot={conversations:{[record.inquiry_id]:record}};version++;listener();}),listGets:()=>f.calls.requests.filter(call=>call.url.startsWith('/api/admin/inquiries?')).length});
}
for(const total of [48,50,51,75,125])test(`Monitor pagination ${total}: canonical prefix, full load-more exact numeric order, no gaps/duplicates`,async()=>{
  const f=await fixture({rows:Array.from({length:total},(_,n)=>row(n+1,{updated_at:n===0?'2040-01-01':time}))});try{
    assert.equal(f.chat().inquiries.length,Math.min(total,50));while(f.chat().hasMore)await f.flush(()=>f.chat().loadMore());
    assert.deepEqual(f.chat().inquiries.map(row=>row.id),Array.from({length:total},(_,n)=>total-n));
  }finally{await f.dispose();}
});
for(const [label,sender]of [['customer','guest'],['same admin second tab','admin'],['different admin','other-admin']])test(`Monitor loaded ${label}: immediate promotion and duplicate INSERT costs 0 list GET`,async()=>{
  const f=await fixture();try{const before=f.listGets(),incoming={...message(99,1,sender),created_at:newTime};await f.emit('INSERT',incoming);assert.equal(f.chat().inquiries[0].id,1);assert.equal(f.chat().inquiries[0].canonical_activity_at,newTime);
    await f.emit('INSERT',incoming);await f.timers(250);assert.equal(f.listGets(),before);assert.equal(f.chat().inquiries.length,2);
  }finally{await f.dispose();}
});
test('Monitor same-tab send: actual POST receipt promotes immediately with 0 detail/list GET',async()=>{
  const f=await fixture();try{const before=f.listGets(),original=f.request;f.request=(url,options)=>url==='/api/inquiries/message'?response({success:true,inquiryId:1,messageId:99,displayContent:'sent',updatedAt:newTime,message:{...message(99,1,'admin'),created_at:newTime}}):original(url,options);
    await f.flush(()=>f.chat().sendMessage(1,'sent'));assert.equal(f.chat().inquiries[0].id,1);await f.timers(250);assert.equal(f.listGets(),before);assert.equal(f.calls.requests.filter(call=>call.url.endsWith('/messages')).length,0);
  }finally{await f.dispose();}
});
for(const sender of ['guest','admin'])test(`Monitor page-2 ${sender} unread=0: bounded 1 GET recovers page1 membership`,async()=>{
  const f=await fixture({rows:Array.from({length:51},(_,n)=>row(n+1,{admin_unread_count:0}))});try{assert.ok(!f.chat().inquiries.some(row=>row.id===1));const before=f.listGets();f.rows[0].canonical_activity_at=newTime;
    await f.emit('INSERT',{...message(99,1,sender),created_at:newTime});await f.timers(250);assert.equal(f.chat().inquiries[0].id,1);assert.equal(f.listGets(),before+1);
  }finally{await f.dispose();}
});
test('Monitor Attention delta unread=0 revalidates unloaded activity; ACK-only delta does not',async()=>{
  const f=await fixture({rows:Array.from({length:75},(_,n)=>row(n+1))});try{const before=f.listGets();f.rows[0].canonical_activity_at=newTime;
    const activity={inquiry_id:1,surface:'monitor',last_message_at:newTime,admin_unread_count:0};await f.attentionUpdate(activity);await f.timers(250);assert.equal(f.chat().inquiries[0].id,1);assert.equal(f.listGets(),before+1);
    await f.attentionUpdate({...activity,admin_unread_count:2});await f.timers(250);assert.equal(f.listGets(),before+1);
  }finally{await f.dispose();}
});
for(const [label,patch,table]of [
  ['status',{id:1,status:'resolved',updated_at:'2040-01-01'},'inquiries'],
  ['metadata',{id:1,content:'changed',updated_at:'2040-01-01'},'inquiries'],
  ['policy',{id:1,has_policy_signal:true,policy_signal_categories:['external_contact'],updated_at:'2040-01-01'},'inquiries'],
  ['ACK',{...message(10,1,'admin'),admin_read_at:newTime},'inquiry_messages'],
  ['participant read_at/is_read',{...message(10,1,'admin'),read_at:newTime,is_read:true},'inquiry_messages'],
])test(`Monitor ${label} update cannot become recency authority`,async()=>{
  const f=await fixture({shared:false});try{const before=f.listGets(),order=f.chat().inquiries.map(row=>row.id);
    await f.emit('UPDATE',patch,table);await f.timers(250);
    assert.deepEqual(f.chat().inquiries.map(row=>row.id),order);assert.equal(f.listGets(),before);
    if(table==='inquiries')for(const [key,value]of Object.entries(patch))assert.deepEqual(f.chat().inquiries.find(row=>row.id===1)[key],value);
  }finally{await f.dispose();}
});
for(const latest of [true,false])test(`Monitor ${latest?'latest':'older'} soft-delete canonical revalidation ${latest?'moves down':'keeps order'}`,async()=>{
  const f=await fixture({rows:[row(1,{canonical_activity_at:newTime}),row(2)]});try{if(latest)f.rows[0].canonical_activity_at='2020-01-01';const before=f.listGets();
    await f.emit('UPDATE',{...message(99,1,'guest'),type:'deleted'});await f.timers(250);assert.equal(f.chat().inquiries[0].id,latest?2:1);assert.equal(f.listGets(),before+1);
    await f.emit('INSERT',{...message(99,1,'guest'),created_at:'2040-01-01'});await f.timers(250);assert.equal(f.chat().inquiries[0].id,latest?2:1);assert.equal(f.listGets(),before+1);
  }finally{await f.dispose();}
});
test('Monitor hard DELETE primary-key tombstone rejects late INSERT and stale detail resurrection',async()=>{
  const f=await fixture();try{await f.flush(()=>f.chat().selectInquiry(1));assert.equal(f.chat().messages.length,1);await f.emit('DELETE',{id:10});assert.equal(f.chat().messages.length,0);
    await f.emit('INSERT',{...message(10,1,'admin'),created_at:newTime});assert.equal(f.chat().messages.length,0);assert.equal(f.chat().inquiries[0].id,2);
    await f.flush(()=>f.chat().retrySelectedInquiry());assert.equal(f.chat().messages.length,0);await f.timers(250);
  }finally{await f.dispose();}
});
test('Monitor fallback ignores updated_at; bigint numeric ties and microseconds retain exact authority',()=>{
  const rows=[row('9007199254740992',{canonical_activity_at:null,created_at:time,updated_at:'2040-01-01'}),row('9007199254740993',{canonical_activity_at:null,created_at:time}),row('9',{canonical_activity_at:'2026-10-06T12:00:00.000001Z',status:'resolved',needs_reply:false})];
  assert.deepEqual(rows.sort(compareCanonicalInquiries).map(row=>row.id),['9','9007199254740993','9007199254740992']);
});
test('Monitor stale list cannot win; 10-message burst produces one serialized trailing GET',async()=>{
  const f=await fixture();try{const first=deferred(),trailing=deferred();let reads=0,active=0,max=0;
    f.request=async()=>{reads++;max=Math.max(max,++active);try{return await(reads===1?first:trailing).promise;}finally{active--;}};
    await f.flush(()=>{void f.chat().refresh(false);});for(let id=99;id<109;id++)await f.emit('INSERT',{...message(id,1,'other-admin'),created_at:newTime});
    await f.flush(()=>first.resolve(response({success:true,data:[row(2)],pagination:{hasMore:false}})));assert.equal(reads,2);assert.equal(max,1);assert.equal(f.chat().inquiries[0].id,1);
    await f.flush(()=>trailing.resolve(response({success:true,data:[row(1,{canonical_activity_at:newTime}),row(2)],pagination:{hasMore:false}})));await f.timers(250);assert.equal(reads,2);
  }finally{await f.dispose();}
});
test('Monitor hidden burst makes 0 requests and visibility catch-up recovers; healthy safety stays 5 min',async()=>{
  const f=await fixture();try{for(const channel of f.calls.channels)await f.flush(()=>channel.status?.('SUBSCRIBED'));const before=f.listGets();await f.advanceTimers(299999);assert.equal(f.listGets(),before);await f.advanceTimers(1);assert.equal(f.listGets(),before+1);
    Object.defineProperty(f.dom.window.document,'hidden',{configurable:true,value:true});Object.defineProperty(f.dom.window.document,'visibilityState',{configurable:true,value:'hidden'});const hidden=f.calls.requests.length;
    for(let id=90;id<100;id++)await f.emit('INSERT',{...message(id,999,'admin'),created_at:newTime});await f.advanceTimers(300000);assert.equal(f.calls.requests.length,hidden);
    Object.defineProperty(f.dom.window.document,'hidden',{configurable:true,value:false});Object.defineProperty(f.dom.window.document,'visibilityState',{configurable:true,value:'visible'});await f.flush(()=>f.dom.window.document.dispatchEvent(new f.dom.window.Event('visibilitychange')));assert.equal(f.calls.requests.length,hidden+1);
  }finally{await f.dispose();}
});
test('Monitor off-page deep link selects without prefix contamination; row movement preserves selection',async()=>{
  const f=await fixture({rows:Array.from({length:75},(_,n)=>row(n+1)),deepLink:1});try{assert.ok(!f.chat().inquiries.some(row=>row.id===1));assert.equal(f.chat().resolvedInquiry.id,1);await f.flush(()=>f.chat().selectInquiry(1));assert.equal(f.chat().selectedInquiry.id,1);assert.equal(f.chat().messages[0].inquiry_id,1);assert.equal(f.chat().inquiries.length,50);
    f.rows[0].canonical_activity_at=newTime;await f.emit('INSERT',{...message(99,1,'admin'),created_at:newTime});await f.timers(250);assert.equal(f.chat().inquiries[0].id,1);assert.equal(f.chat().selectedInquiry.id,1);
  }finally{await f.dispose();}
});
test('Monitor selected-thread detail requests remain serialized max=1 under burst',async()=>{
  const f=await fixture();try{await f.flush(()=>f.chat().selectInquiry(1));const gate=deferred(),original=f.request;let active=0,max=0,reads=0;
    f.request=async(url,options)=>{if(!url.endsWith('/messages'))return original(url,options);reads++;max=Math.max(max,++active);try{if(reads===1)await gate.promise;return original(url,options);}finally{active--;}};
    await f.flush(()=>{void f.chat().retrySelectedInquiry();});for(let id=99;id<109;id++)await f.emit('INSERT',{...message(id,1,'guest'),created_at:newTime});await f.timers(250);assert.equal(reads,1);
    await f.flush(()=>gate.resolve());assert.equal(max,1);assert.equal(reads,2);
  }finally{await f.dispose();}
});
test('Monitor load-more invalidation retains both requested canonical pages',async()=>{
  const f=await fixture({rows:Array.from({length:75},(_,n)=>row(n+1))});try{const gates=[deferred(),deferred()],old=f.rows.slice().sort(compareCanonicalInquiries).map(row=>({...row})),original=f.request;let reads=0,pending;
    f.request=(url,options)=>{if(!url.startsWith('/api/admin/inquiries?'))return original(url,options);reads++;return reads<=2?gates[reads-1].promise:original(url,options);};
    await f.flush(()=>{pending=f.chat().loadMore();});f.rows[0].canonical_activity_at=newTime;await f.emit('INSERT',{...message(99,1,'admin'),created_at:newTime});
    await f.flush(()=>gates[0].resolve(response({success:true,data:old.slice(0,50),pagination:{hasMore:true}})));await f.flush(()=>gates[1].resolve(response({success:true,data:old.slice(50),pagination:{hasMore:false}})));await f.flush(()=>pending);
    assert.equal(f.chat().inquiries.length,75);assert.equal(f.chat().inquiries[0].id,1);assert.equal(new Set(f.chat().inquiries.map(row=>row.id)).size,75);assert.equal(reads,4);
  }finally{await f.dispose();}
});
test('Measured baseline/current Monitor GET counts: loaded 0→0, unloaded admin unread=0 0→1',async()=>{
  const path='app/admin/dashboard/hooks/useAdminChatQuery.ts';const baseline=readFileSync('tests/unit/fixtures/admin-monitor-before-recency.ts.txt','utf8');
  assert.equal(createHash('sha256').update(baseline).digest('hex'),'904c1a9ef64c4896c4e4c89131d545aae3d4f4a4343965f5a0f87312dc11632c');
  const counts={};for(const [label,sources]of [['before',{[resolve(path)]:baseline}],['after',{}]]){const f=await fixture({rows:Array.from({length:75},(_,n)=>row(n+1)),sources});try{let before=f.listGets();await f.emit('INSERT',{...message(99,75,'admin'),created_at:newTime});await f.timers(250);const loaded=f.listGets()-before;before=f.listGets();await f.emit('INSERT',{...message(100,1,'admin'),created_at:newTime});await f.timers(250);counts[label]={loaded,unloaded:f.listGets()-before};}finally{await f.dispose();}}
  assert.deepEqual(counts,{before:{loaded:0,unloaded:0},after:{loaded:0,unloaded:1}});console.log('MONITOR_GET_COMPARISON',JSON.stringify(counts));
});

test('Monitor migration introduces one read-only function and no Pin/table/column/index authority',()=>{
  const sql=readFileSync('supabase/migrations/20261007024725_admin_chat_monitor_canonical_recency.sql','utf8');
  assert.equal((sql.match(/CREATE FUNCTION/g)??[]).length,1);
  assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE)\s+(?:INTO|FROM|TABLE|FUNCTION|INDEX)|CREATE\s+(?:TABLE|INDEX)|\bpin(?:ned|s)?\b/i);
  assert.match(sql,/STABLE SECURITY INVOKER SET search_path = ''/);
});
