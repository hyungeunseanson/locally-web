import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { clientFixture, inquiry, message, response, deferred } from './helpers/chatRuntime.mjs';

async function fixture() {
  const f=clientFixture({role:'admin',rows:[inquiry(1,'admin_support'),inquiry(2,'admin_support')]});
  f.auth=async()=>({data:{user:{id:'admin'}}});
  const useChat=f.load('app/admin/dashboard/hooks/useAdminChatQuery.ts').useAdminChatQuery;
  const attention=f.load('app/admin/dashboard/components/AdminAttentionProvider.tsx');
  const state={chat:null,counts:null}, pending=[],ack=deferred(); let active=0,maxActive=0;
  const original=f.request;
  f.request=async(url,options)=>{
    if(url.startsWith('/api/admin/sidebar-counts'))return response({success:true,data:{conversations:[{inquiry_id:1,surface:'phone',admin_unread_count:1,last_message_id:'10'}],adminAlertsUnread:0}});
    if(url.endsWith('/ack'))return ack.promise;
    if(!url.endsWith('/messages'))return original(url,options);
    const gate=deferred(),id=Number(url.split('/')[4]); pending.push({...gate,id}); maxActive=Math.max(maxActive,++active);
    try{return await gate.promise;}finally{active--;}
  };
  function Probe(){const chat=useChat({conversationOnly:true}); const counts=attention.useAdminAttentionSnapshot();
    React.useEffect(()=>{state.chat=chat;state.counts=counts;});
    return React.createElement('div',{'data-loading':String(chat.isMessagesLoading)},chat.messages.map(row=>React.createElement('p',{key:row.id},row.content)));
  }
  function Root(){return React.createElement(attention.default,{userId:'admin'},React.createElement(Probe));}
  await f.mount(Root);
  return Object.assign(f,{state,pending,ack,maxActive:()=>maxActive,
    select:id=>f.flush(()=>{void state.chat.selectInquiry(id);}),
    finish:(i,content=`snapshot-${i}`)=>f.flush(()=>pending[i].resolve(response({success:true,inquiry:{...f.rows.find(row=>row.id===pending[i].id),admin_unread_count:1},data:[message(10+i,pending[i].id,'guest',content)]}))),
    trigger:event=>f.flush(()=>{if(event==='SUBSCRIBED')for(const channel of f.calls.channels)channel.status?.(event);
      else if(event==='visibilitychange')f.dom.window.document.dispatchEvent(new f.dom.window.Event(event));
      else f.dom.window.dispatchEvent(new f.dom.window.Event(event));}),
  });
}
for(const event of ['SUBSCRIBED','visibilitychange','online'])test(`real attention provider + phone initial/${event}: shared flight, settled spinner, trailing refresh and independent pending ACK`,async()=>{
  const f=await fixture();
  try{
    await f.select(1); await f.trigger(event); assert.equal(f.pending.length,1);
    await f.finish(0); assert.equal(f.state.chat.isMessagesLoading,false); assert.match(f.dom.window.document.body.textContent,/snapshot-0/);
    assert.equal(f.calls.requests.filter(r=>r.url.endsWith('/ack')).length,1,'rendered first snapshot ACK does not wait for trailing GET');
    assert.equal(f.pending.length,2); assert.equal(f.maxActive(),1);
    await f.finish(1); assert.equal(f.state.chat.isMessagesLoading,false);
    await f.flush(()=>f.ack.resolve(response({success:false},500))); assert.equal(f.state.counts.conversations['1'].admin_unread_count,1);
  }finally{await f.dispose();}
});
test('real attention provider A→B→A rejects old response/loading completion; unread-only UPDATE deltas do not GET the thread',async()=>{
  const f=await fixture();
  try{
    await f.select(1);await f.select(2);await f.select(1);
    await f.finish(0,'stale A');assert.equal(f.state.chat.isMessagesLoading,true);
    await f.finish(1,'stale B');assert.equal(f.state.chat.isMessagesLoading,true);
    await f.finish(2,'latest A');assert.equal(f.state.chat.isMessagesLoading,false); assert.equal(f.state.chat.messages[0].content,'latest A');
    const gets=f.calls.requests.filter(r=>r.url.endsWith('/messages')).length;
    await f.flush(()=>{for(let i=0;i<10;i++)for(const channel of f.calls.channels)for(const [,filter,cb]of channel.handlers){
      if(filter.table==='inquiry_messages'&&['*','UPDATE'].includes(filter.event))cb({eventType:'UPDATE',new:{...message(12,1,'guest'),admin_read_at:'2026-10-02T12:00Z'},old:{id:12}});
    }});await f.timers(250);
    assert.equal(f.calls.requests.filter(r=>r.url.endsWith('/messages')).length,gets);
    assert.equal(f.state.chat.isMessagesLoading,false);
    await f.flush(()=>f.ack.resolve(response({success:false},500)));
  }finally{await f.dispose();}
});
