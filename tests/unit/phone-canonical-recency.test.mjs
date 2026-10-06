import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {clientFixture,response,deferred,message} from './helpers/chatRuntime.mjs';
const row=n=>({id:`request-${n}`,user_id:'guest',category:'GENERAL',status:'PENDING',payment_status:'COMPLETED',payment_channel:'LOCALLY',
  form_data:{business_name:`Fixture ${n}`,linked_inquiry_id:String(n)},linked_inquiry_id:String(n),profiles:{full_name:'Fixture customer'},
  needs_reply:false,needs_attention:false,admin_unread_count:0,latest_created_at:'2026-10-06T12:00:00Z',canonical_activity_at:'2026-10-06T12:00:00Z',created_at:'2025-01-01T00:00:00Z'});
async function fixture(){
  let chatProps;const f=clientFixture({role:'admin',additionalStubs:{
    './ChatMonitor':{default:props=>{chatProps=props;return null;}},'./AdminChatSearch':{default:()=>null},'./PhonePaymentDetails':{default:()=>null},
    './AdminAttentionProvider':{useAdminAttentionSnapshot:()=>({ready:true,conversations:{}})},
    '@/app/hooks/useConfirmDialog':{useConfirmDialog:()=>({requestConfirm(){},ConfirmDialogElement:null})},
  }});
  f.rows=Array.from({length:25},(_,n)=>row(n+1));
  f.request=async()=>response({success:true,data:f.rows.slice(0,10).map(row=>({...row})),pagination:{hasMore:true}});
  const Phone=f.load('app/admin/dashboard/components/PhoneReservationTab.tsx').default;
  await f.mount(()=>React.createElement(Phone));
  return Object.assign(f,{props:()=>chatProps,
    order:()=>[...f.dom.window.document.querySelectorAll('[data-testid="admin-phone-reservation-list-item"] [title]')].map(node=>node.title),
    emit:(event,record)=>f.flush(()=>{for(const channel of f.calls.channels)for(const [,filter,cb]of channel.handlers)if(filter.table==='inquiry_messages'&&filter.event===event)cb({new:record,old:record,eventType:event});}),
    listGets:()=>f.calls.requests.filter(row=>row.url.startsWith('/api/admin/customer-support?')).length,
  });
}
for(const sender of ['guest','admin','other-admin'])test(`Phone: unloaded ${sender} unread=0 enters page1 after one 350ms invalidation; duplicates do not GET`,async()=>{
  const f=await fixture();try{const before=f.listGets();assert.equal(f.order()[0],'Fixture 1');const promoted=f.rows.pop();f.rows.unshift(promoted);
    const incoming={...message(99,25,sender),created_at:'2026-10-06T13:00:00Z'};await f.emit('INSERT',incoming);await f.emit('INSERT',incoming);
    await f.timers(250);assert.equal(f.listGets(),before);await f.timers(350);assert.equal(f.listGets(),before+1);assert.equal(f.order()[0],'Fixture 25');
    await f.emit('INSERT',incoming);await f.timers(350);assert.equal(f.listGets(),before+1);
  }finally{await f.dispose();}
});
test('Phone: list GET in-flight rejects stale membership; burst shares one serialized trailing refresh and maximum concurrent GET=1',async()=>{
  const f=await fixture();try{const first=deferred(),second=deferred();let active=0,max=0,reads=0;f.request=async()=>{reads++;max=Math.max(max,++active);try{return await(reads===1?first:second).promise;}finally{active--;}};
    await f.flush(()=>f.props().phoneContext.onSent());assert.equal(reads,1);
    for(let id=99;id<109;id++)await f.emit('INSERT',{...message(id,25,'admin'),created_at:'2026-10-06T13:00:00Z'});
    await f.timers(350);assert.equal(reads,1);
    await f.flush(()=>first.resolve(response({success:true,data:[row(25)],pagination:{hasMore:false}})));
    assert.equal(reads,2);assert.equal(f.order()[0],'Fixture 1','stale snapshot never commits');
    await f.flush(()=>second.resolve(response({success:true,data:[row(25),row(1)],pagination:{hasMore:false}})));
    assert.equal(max,1);assert.equal(f.order()[0],'Fixture 25');await f.timers(350);assert.equal(reads,2);
  }finally{await f.dispose();}
});
test('Phone: onSent returns the canonical server order; receipt updates do not invalidate activity',async()=>{
  const f=await fixture();try{const promoted=f.rows.pop();f.rows.unshift(promoted);await f.flush(()=>f.props().phoneContext.onSent());assert.equal(f.order()[0],'Fixture 25');
    const before=f.listGets();await f.emit('UPDATE',{...message(99,25,'admin'),admin_read_at:'2026-10-06T13:00:00Z'});await f.timers(350);assert.equal(f.listGets(),before);
  }finally{await f.dispose();}
});
test('Phone: hidden burst creates no traffic, visibility catch-up recovers',async()=>{
  const f=await fixture();try{const before=f.listGets();Object.defineProperty(f.dom.window.document,'hidden',{configurable:true,value:true});
    for(let id=99;id<109;id++)await f.emit('INSERT',message(id,25,'admin'));await f.timers(350);assert.equal(f.listGets(),before);
    Object.defineProperty(f.dom.window.document,'hidden',{configurable:true,value:false});await f.flush(()=>f.dom.window.document.dispatchEvent(new f.dom.window.Event('visibilitychange')));assert.equal(f.listGets(),before+1);
  }finally{await f.dispose();}
});
