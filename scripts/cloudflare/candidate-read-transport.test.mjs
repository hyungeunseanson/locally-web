import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { Agent } from 'undici';
import { createCandidateReadTransport } from './candidate-read-transport.mjs';
const origin='https://candidate.example';
function fixture(options={}){
 let configuration,closed=0,fetches=0;
 const transport=createCandidateReadTransport(origin,{resolve:async()=>[{address:'192.0.2.1',ttl:10}],...options,makeDispatcher:o=>{configuration=o;return{close:async()=>closed++}},fetchImplementation:async(_url,o)=>{fetches++;return o}});
 return{transport,lookup:(host='candidate.example',opts={all:true})=>new Promise((resolve,reject)=>configuration.connect.lookup(host,opts,(e,address,family)=>e?reject(e):resolve({address,family}))),configuration:()=>configuration,counts:()=>({closed,fetches})};
}
test('parallel candidate connections coalesce one DNS answer and expire at authoritative TTL',async()=>{
 let now=0,calls=0;
 const f=fixture({clock:()=>now,resolve:async()=>{calls++;await new Promise(r=>setImmediate(r));return[{address:'192.0.2.1',ttl:1}]}});
 const rows=await Promise.all(Array.from({length:8},()=>f.lookup()));assert.equal(calls,1);assert(rows.every(r=>r.address[0].address==='192.0.2.1'));
 now=999;await f.lookup();assert.equal(calls,1);now=1000;await f.lookup();assert.equal(calls,2);
 assert.equal(f.configuration().connections,8);assert.equal(f.configuration().pipelining,0);assert.equal(f.configuration().connect.rejectUnauthorized,undefined);
 await f.transport.close();assert.equal(f.counts().closed,1);
});
test('DNS ENOTFOUND fails every waiting request without retry or stale fallback',async()=>{
 let calls=0,now=0;
 const f=fixture({clock:()=>now,resolve:async()=>{calls++;if(calls===1)return[{address:'192.0.2.1',ttl:1}];throw Object.assign(Error('fixture'),{code:'ENOTFOUND'})}});
 await f.lookup();now=1000;const rows=await Promise.allSettled(Array.from({length:8},()=>f.lookup()));
 assert.equal(calls,2);assert(rows.every(r=>r.status==='rejected'&&r.reason.code==='ENOTFOUND'));assert.equal(f.counts().fetches,0);await f.transport.close();
});
for(const records of [[],[{address:'invalid',ttl:1}],[{address:'192.0.2.1',ttl:0}],[{address:'192.0.2.1',ttl:NaN}]])test('invalid/empty/expired DNS representation is rejected '+JSON.stringify(records),async()=>{
 const f=fixture({resolve:async()=>records});await assert.rejects(f.lookup(),{code:'ERR_CANDIDATE_DNS_ANSWER'});await f.transport.close();
});
test('only exact origin read requests use dispatcher; headers/redirect/signal stay intact and body error is not retried',async()=>{
 const f=fixture();const signal=new AbortController().signal,headers={'Cloudflare-Workers-Version-Overrides':'exact-version',rsc:'1'};
 const row=await f.transport.fetch(origin+'/page?_rsc=fixture',{method:'GET',headers,signal,redirect:'manual'});assert.equal(row.headers,headers);assert.equal(row.signal,signal);assert.equal(row.redirect,'manual');assert(row.dispatcher);
 assert.throws(()=>f.transport.fetch('https://other.example/read'));assert.throws(()=>f.transport.fetch(origin+'/write',{method:'POST'}));
 await assert.rejects(f.lookup('other.example'),{code:'ERR_CANDIDATE_DNS_SCOPE'});await f.transport.close();assert.throws(()=>f.transport.fetch(origin));
});

test('fresh read connections avoid an idle peer-close race without replaying HTTP requests', async () => {
  const perSocket = new WeakMap(), rows = [];
  const server = createServer((req, res) => {
    const count = (perSocket.get(req.socket) ?? 0) + 1; perSocket.set(req.socket, count); rows.push({ count, port: req.socket.remotePort });
    if (count > 1) { req.socket.destroy(); return; }
    res.writeHead(200, { 'content-type': 'text/plain' }).end('complete');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const local = `http://127.0.0.1:${server.address().port}`;
  const reusable = new Agent({ connections: 1, pipelining: 1 }), fresh = createCandidateReadTransport(local);
  try {
    assert.equal(await (await fetch(local, { dispatcher: reusable })).text(), 'complete');
    await new Promise(r => setImmediate(r));
    await assert.rejects(fetch(local, { dispatcher: reusable })); assert.equal(rows.length, 2); assert.equal(rows[1].count, 2);
    const before = rows.length;
    for (let i = 0; i < 2; i++) assert.equal(await (await fresh.fetch(local)).text(), 'complete');
    assert.equal(rows.length - before, 2); assert(rows.slice(before).every(r => r.count === 1));
  } finally { await reusable.close(); await fresh.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
});
test('fresh sockets still reject a real reset exactly once and do not retry', async () => {
  let calls = 0; const server = createServer(req => { calls++; req.socket.destroy(); });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const local = `http://127.0.0.1:${server.address().port}`, transport = createCandidateReadTransport(local);
  try { await assert.rejects(transport.fetch(local)); assert.equal(calls, 1); }
  finally { await transport.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
});
