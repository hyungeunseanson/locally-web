import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { sourceLoader, clientFixture, inquiry, message, response, deferred } from './helpers/chatRuntime.mjs';
const {compareCanonicalInquiries,activityMicros}=sourceLoader()('app/utils/adminCanonicalRecency.ts');
const time='2026-10-06T12:00:00Z',newTime='2026-10-06T12:30:00Z';
const row=(id,type='admin_support',extra={})=>({...inquiry(id,type),created_at:'2025-01-01T00:00:00Z',canonical_activity_at:time,last_message_at:time,...extra});
const attention={subscribe:()=>()=>{},version:()=>0,getSnapshot:()=>({conversations:{}})};
async function fixture({rows=[row(1),row(2)],view='support',shared=true}={}){
  const f=clientFixture({role:'admin',rows,additionalStubs:{'../components/AdminAttentionProvider':{useAdminAttention:()=>shared?attention:null}}});
  f.auth=async()=>({data:{user:{id:'admin'}}});
  const useQuery=f.load('app/admin/dashboard/hooks/useAdminChatQuery.ts').useAdminChatQuery;
  let state;function Probe(){const chat=useQuery({view});React.useEffect(()=>{state=chat;});return null;}
  const original=f.request;
  f.request=async(url,options)=>{
    if(!url.startsWith('/api/admin/inquiries?'))return original(url,options);
    const offset=Number(new URL(url,'http://fixture.test').searchParams.get('offset'));
    return response({success:true,data:f.rows.slice().sort(compareCanonicalInquiries).slice(offset,offset+50).map(row=>({...row})),pagination:{hasMore:f.rows.length>offset+50}});
  };
  await f.mount(Probe);
  return Object.assign(f,{chat:()=>state,emit:(event,record)=>f.flush(()=>{for(const channel of f.calls.channels)for(const [,filter,callback]of channel.handlers)if(filter.table==='inquiry_messages'&&filter.event===event)callback({new:event==='DELETE'?{}:record,old:event==='DELETE'?record:{},eventType:event});}),
    listGets:()=>f.calls.requests.filter(call=>call.url.startsWith('/api/admin/inquiries?')).length});
}
test('Support 1/2/14/15: pure canonical recency, creation fallback, numeric bigint ties and microsecond precision',()=>{
  const rows=[row('9007199254740993','admin_support',{needs_reply:true,status:'open',canonical_activity_at:time}),row('9','admin_support',{needs_reply:false,status:'resolved',canonical_activity_at:newTime}),row('9007199254740992','admin_support',{canonical_activity_at:time})];
  assert.deepEqual(rows.sort(compareCanonicalInquiries).map(row=>row.id),['9','9007199254740993','9007199254740992']);
  assert.ok(compareCanonicalInquiries(row(1,'admin_support',{canonical_activity_at:null,created_at:newTime,updated_at:'2020-01-01'}),row(2))<0);
  assert.ok(activityMicros('2026-10-06T12:00:00.000002Z')>activityMicros('2026-10-06T21:00:00.000001+09:00'));
});
for(const [label,sender]of [['customer','guest'],['other admin','other-admin'],['same admin second tab','admin']])test(`Support 3/5/8: loaded ${label} immediately promotes; duplicate receipts coalesce`,async()=>{
  const f=await fixture({rows:[row(1),row(2,'admin_support',{needs_reply:true})]});
  try{const before=f.listGets();const incoming={...message(99,1,sender),created_at:newTime};await f.emit('INSERT',incoming);assert.equal(String(f.chat().inquiries[0].id),'1');
    await f.emit('INSERT',incoming);await f.timers(250);assert.equal(f.listGets(),before,'loaded unfiltered recency needs no list GET with shared attention');
    assert.equal(f.chat().inquiries.length,2);
  }finally{await f.dispose();}
});
test('Support 4: canonical same-tab POST immediately promotes without a detail GET',async()=>{
  const f=await fixture();try{const original=f.request;f.request=async(url,options)=>url==='/api/inquiries/message'?response({success:true,inquiryId:1,messageId:99,displayContent:'sent',updatedAt:newTime,message:{...message(99,1,'admin','sent'),created_at:newTime}}):original(url,options);
    await f.flush(()=>f.chat().sendMessage(1,'sent'));assert.equal(String(f.chat().inquiries[0].id),'1');assert.equal(f.calls.requests.filter(row=>row.url.endsWith('/messages')).length,0);
  }finally{await f.dispose();}
});
for(const sender of ['guest','admin','other-admin'])test(`Support 6/7: unloaded ${sender} promotes with unread=0 and bounded canonical prefix recovery`,async()=>{
  const f=await fixture({rows:Array.from({length:75},(_,n)=>row(n+1))});try{
    assert.ok(!f.chat().inquiries.some(row=>row.id===1));const before=f.listGets();f.rows[0].canonical_activity_at=newTime;
    await f.emit('INSERT',{...message(100,1,sender),created_at:newTime});await f.timers(250);
    assert.equal(String(f.chat().inquiries[0].id),'1');assert.equal(f.listGets(),before+1);
  }finally{await f.dispose();}
});
test('Support 10/11: receipt/status-only updates cannot change canonical order; backdated visible INSERT cannot demote',async()=>{
  const f=await fixture();try{const before=f.chat().inquiries.map(row=>row.id),gets=f.listGets();
    await f.emit('UPDATE',{...message(10,2,'admin'),admin_read_at:newTime});
    await f.flush(()=>{for(const channel of f.calls.channels)for(const [,filter,cb]of channel.handlers)if(filter.table==='inquiries'&&filter.event==='UPDATE')cb({new:{id:2,status:'resolved',updated_at:newTime}});});
    await f.emit('INSERT',{...message(11,2,'admin'),created_at:'2020-01-01T00:00:00Z'});await f.timers(250);
    assert.deepEqual(f.chat().inquiries.map(row=>row.id),before);assert.equal(f.listGets(),gets);
  }finally{await f.dispose();}
});
test('Race 29/30/35: in-flight stale membership never wins; burst produces one serialized trailing list GET',async()=>{
  const f=await fixture();try{const first=deferred(),trailing=deferred();let reads=0,active=0,max=0;
    const original=f.request;f.request=async(url,options)=>{if(!url.startsWith('/api/admin/inquiries?'))return original(url,options);reads++;max=Math.max(max,++active);try{return await(reads===1?first:trailing).promise;}finally{active--;}};
    await f.flush(()=>{void f.chat().refresh(false);});assert.equal(reads,1);
    for(let id=99;id<109;id++)await f.emit('INSERT',{...message(id,1,'other-admin'),created_at:newTime});
    await f.emit('INSERT',{...message(99,1,'other-admin'),created_at:newTime});
    assert.equal(String(f.chat().inquiries[0].id),'1');
    await f.flush(()=>first.resolve(response({success:true,data:[row(2)],pagination:{hasMore:false}})));
    assert.equal(reads,2);assert.equal(max,1);assert.equal(String(f.chat().inquiries[0].id),'1','discarded stale response cannot remove promoted row');
    await f.flush(()=>trailing.resolve(response({success:true,data:[row(1,'admin_support',{canonical_activity_at:newTime}),row(2)],pagination:{hasMore:false}})));
    assert.equal(String(f.chat().inquiries[0].id),'1');await f.timers(250);assert.equal(reads,2);
  }finally{await f.dispose();}
});
test('Race 33: hidden tab makes no event-driven list/detail traffic; visible catch-up recovers unread=0',async()=>{
  const f=await fixture();try{const before=f.calls.requests.length;Object.defineProperty(f.dom.window.document,'hidden',{configurable:true,value:true});Object.defineProperty(f.dom.window.document,'visibilityState',{configurable:true,value:'hidden'});
    await f.emit('INSERT',{...message(99,999,'admin'),created_at:newTime});await f.advanceTimers(60_000);assert.equal(f.calls.requests.length,before);
    Object.defineProperty(f.dom.window.document,'hidden',{configurable:true,value:false});Object.defineProperty(f.dom.window.document,'visibilityState',{configurable:true,value:'visible'});
    await f.flush(()=>f.dom.window.document.dispatchEvent(new f.dom.window.Event('visibilitychange')));assert.equal(f.listGets(),before+1);
  }finally{await f.dispose();}
});
test('Monitor 37: loaded incoming/outgoing pure recency, no needs_reply/status priority; latest soft-delete restores fallback',async()=>{
  const f=await fixture({view:'monitor',rows:[row(1,'general',{needs_reply:true}),row(2,'general',{status:'resolved'})]});try{
    await f.emit('INSERT',{...message(99,2,'admin'),created_at:newTime});assert.equal(String(f.chat().inquiries[0].id),'2');
    await f.emit('INSERT',{...message(100,1,'guest'),created_at:'2026-10-06T13:00:00Z'});assert.equal(String(f.chat().inquiries[0].id),'1');
    const original=f.request;f.request=async(url,options)=>url.startsWith('/api/admin/inquiries?')?response({success:true,data:[row(1,'general'),row(2,'general',{last_message_at:newTime})],pagination:{hasMore:false}}):original(url,options);
    await f.emit('UPDATE',{...message(100,1,'guest'),type:'deleted'});await f.timers(250);assert.equal(String(f.chat().inquiries[0].id),'2');
  }finally{await f.dispose();}
});

test('Race: unmount cancels queued trailing list ownership without orphan traffic',async()=>{
  const f=await fixture(),gate=deferred();let reads=0,pending;
  f.request=async()=>{reads++;return gate.promise;};
  await f.flush(()=>{pending=f.chat().refresh(false);});
  await f.emit('INSERT',{...message(99,999,'admin'),created_at:newTime});
  await f.dispose();gate.resolve(response({success:true,data:[row(1)],pagination:{hasMore:false}}));await pending;
  assert.equal(reads,1);
});
test('Race: load-more invalidated during GET retains the requested pages in trailing canonical revalidation',async()=>{
  const f=await fixture({rows:Array.from({length:75},(_,n)=>row(n+1))});
  try{const first=deferred(),second=deferred();const old=f.rows.slice().sort(compareCanonicalInquiries).map(row=>({...row}));
    const original=f.request;let reads=0,pending;
    f.request=async(url,options)=>{if(!url.startsWith('/api/admin/inquiries?'))return original(url,options);reads++;if(reads<=2)return(reads===1?first:second).promise;return original(url,options);};
    await f.flush(()=>{pending=f.chat().loadMore();});f.rows[0].canonical_activity_at=newTime;
    await f.emit('INSERT',{...message(99,1,'admin'),created_at:newTime});
    await f.flush(()=>first.resolve(response({success:true,data:old.slice(0,50),pagination:{hasMore:true}})));
    await f.flush(()=>second.resolve(response({success:true,data:old.slice(50),pagination:{hasMore:false}})));
    await f.flush(()=>pending);assert.equal(f.chat().inquiries.length,75);assert.equal(String(f.chat().inquiries[0].id),'1');assert.equal(reads,4);
  }finally{await f.dispose();}
});
