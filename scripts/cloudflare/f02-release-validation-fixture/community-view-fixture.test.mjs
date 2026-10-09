import test from 'node:test';import assert from 'node:assert/strict';
import {isolateCommunityView} from './community-view-fixture.mjs';
import {installProductionMutationGate} from '../run-production-browser-smoke.mjs';
const origin='https://www.locally-travel.com',id='c17ce39a-2dfc-496d-95fb-c9bd2a8cfdf1';
for(const changes of [{},{method:'PUT'},{method:'DELETE'},{pathname:'/api/community/views-other'},{pathname:'/api/community/likes'},{query:'?extra=1'},{origin:'https://external.example'},{frame:'/community/other'},{body:'invalid'},{body:{postId:'wrong',knownViewCount:1}},{body:{postId:id,knownViewCount:-1}},{body:{postId:id,knownViewCount:1,extra:true}}]) test('isolates only exact known read-only Community view '+JSON.stringify(changes),async()=>{
 const handlers=[],context={route:async(_p,h)=>handlers.push(h)};const gate=await installProductionMutationGate(context,origin);const receipts=await isolateCommunityView(context,origin,id);let fulfilled=0,aborted=0;
 const request={url:()=> (changes.origin??origin)+(changes.pathname??'/api/community/views')+(changes.query??''),method:()=>changes.method??'POST',resourceType:()=> 'fetch',postData:()=>typeof changes.body==='string'?changes.body:JSON.stringify(changes.body??{postId:id,knownViewCount:1}),frame:()=>({url:()=>origin+(changes.frame??'/community/'+id)})};
 const route={request:()=>request,fulfill:async()=>fulfilled++,abort:async()=>aborted++,fallback:async()=>handlers[0](route)};await handlers[1](route);
 if(!Object.keys(changes).length){assert.equal(fulfilled,1);assert.equal(receipts.length,1);assert.equal(gate.blockedUnexpectedWrites.length,0)}else{assert.equal(fulfilled,0);assert.equal(receipts.length,0);assert.equal(aborted,1);assert.equal(gate.blockedUnexpectedWrites.length+gate.blockedUnexpectedExternalWrites.length,1)}
});
