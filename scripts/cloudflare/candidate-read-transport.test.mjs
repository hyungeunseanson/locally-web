import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { createSecureServer, constants as h2 } from 'node:http2';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Agent, buildConnector } from 'undici';
import { createCandidateReadTransport } from './candidate-read-transport.mjs';
const origin='https://candidate.example';
function fixture(options={}){
 let configuration,connectOptions,closed=0,fetches=0;
 const transport=createCandidateReadTransport(origin,{resolve:async()=>[{address:'192.0.2.1',ttl:10}],...options,makeConnector:o=>{connectOptions=o;return()=>{}},makeDispatcher:o=>{configuration=o;return{destroy:async()=>closed++}},fetchImplementation:async(_url,o)=>{fetches++;return o}});
 return{transport,lookup:(host='candidate.example',opts={all:true})=>new Promise((resolve,reject)=>connectOptions.lookup(host,opts,(e,address,family)=>e?reject(e):resolve({address,family}))),configuration:()=>configuration,connectOptions:()=>connectOptions,counts:()=>({closed,fetches})};
}
test('parallel candidate connections coalesce one DNS answer and expire at authoritative TTL',async()=>{
 let now=0,calls=0;
 const f=fixture({clock:()=>now,resolve:async()=>{calls++;await new Promise(r=>setImmediate(r));return[{address:'192.0.2.1',ttl:1}]}});
 const rows=await Promise.all(Array.from({length:8},()=>f.lookup()));assert.equal(calls,1);assert(rows.every(r=>r.address[0].address==='192.0.2.1'));
 now=999;await f.lookup();assert.equal(calls,1);now=1000;await f.lookup();assert.equal(calls,2);
  assert.equal(f.configuration().connections,8);assert.equal(f.configuration().pipelining,0);assert.equal(f.connectOptions().rejectUnauthorized,undefined);
  assert.equal(f.connectOptions().allowH2,true);assert.equal(f.configuration().allowH2,true);assert.equal(f.configuration().maxConcurrentStreams,8);
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

// A generated certificate is trusted only by this loopback fixture's dispatcher.
// The production constructor never changes CA, rejectUnauthorized or hostname.
async function tlsFixture(handler, hostname = 'localhost') {
  const directory = await mkdtemp(join(tmpdir(), 'candidate-h2-contract-'));
  const config = join(directory, 'openssl.cnf'), key = join(directory, 'key.pem'), cert = join(directory, 'cert.pem');
  await writeFile(config, '[req]\ndistinguished_name=dn\nx509_extensions=v3\nprompt=no\n[dn]\nCN='+hostname+'\n[v3]\nsubjectAltName=DNS:'+hostname+'\nbasicConstraints=critical,CA:TRUE\n');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-config', config, '-keyout', key, '-out', cert], { stdio: 'ignore' });
  const ca = await readFile(cert), server = createSecureServer({ key: await readFile(key), cert: ca });
  const sessions = new Set(), calls = [];
  server.on('session', session => { sessions.add(session); session.on('error', () => {}); session.on('close', () => sessions.delete(session)); });
  server.on('stream', (stream, headers) => { stream.on('error', () => {}); calls.push({ path: headers[':path'], override: headers['cloudflare-workers-version-overrides'], protocol: stream.session.socket.alpnProtocol }); handler(stream, headers); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const local = `https://localhost:${server.address().port}`;
  const transport = (trusted = true) => createCandidateReadTransport(local, {
    resolve: async () => [{ address: '127.0.0.1', ttl: 60 }],
    makeConnector: options => buildConnector({ ...options, ...(trusted ? { ca } : {}) }),
  });
  return { local, transport, calls, close: async () => { for (const session of sessions) session.destroy(); await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); } };
}

test('verified TLS H2 preserves bytes, status, override and concurrent request identity', async () => {
  const f = await tlsFixture((stream, headers) => { stream.respond({ ':status': headers[':path'] === '/error' ? 503 : 200 }); stream.end('actual-body'); }), transport = f.transport();
  try {
    const rows = await Promise.all(['/one', '/two', '/error'].map(async path => {
      const response = await transport.fetch(f.local + path, { method: 'GET', redirect: 'manual', headers: { 'Cloudflare-Workers-Version-Overrides': 'exact' }, signal: AbortSignal.timeout(2000) });
      return { path, status: response.status, body: await response.text() };
    }));
    assert(rows.every(r => r.body === 'actual-body')); assert.equal(rows.find(r => r.path === '/error').status, 503);
    assert.equal(f.calls.length, 3); assert(f.calls.every(r => r.protocol === 'h2' && r.override === 'exact'));
  } finally { await transport.close(); await f.close(); }
});
test('H2 never bypasses an untrusted TLS certificate', async () => {
  const f = await tlsFixture(stream => { stream.respond({ ':status': 200 }); stream.end('must-not-load'); }), transport = f.transport(false);
  try { await assert.rejects(transport.fetch(f.local, { signal: AbortSignal.timeout(2000) })); assert.equal(f.calls.length, 0); }
  finally { await transport.close(); await f.close(); }
});
for (const code of [h2.NGHTTP2_INTERNAL_ERROR, h2.NGHTTP2_REFUSED_STREAM, h2.NGHTTP2_CANCEL]) test(`H2 stream reset ${code} fails exactly once without replay`, async () => {
  const f = await tlsFixture(stream => stream.close(code)), transport = f.transport();
  try { await assert.rejects(transport.fetch(f.local, { signal: AbortSignal.timeout(2000) })); assert.equal(f.calls.length, 1); }
  finally { await transport.close(); await f.close(); }
});
test('H2 partial body stalls still fail at the supplied deadline without replay', async () => {
  const f = await tlsFixture(stream => { stream.respond({ ':status': 200 }); stream.write('partial'); }), transport = f.transport();
  try {
    const signal = AbortSignal.timeout(150), response = await transport.fetch(f.local, { signal }); assert.equal(response.status, 200);
    await assert.rejects(response.text()); assert(signal.aborted); assert.equal(f.calls.length, 1);
  } finally { await transport.close(); await f.close(); }
});
test('H2 truncated content length fails instead of accepting partial bytes', async () => {
  const f = await tlsFixture(stream => { stream.respond({ ':status': 200, 'content-length': '100' }); stream.end('partial'); }), transport = f.transport();
  try { const response = await transport.fetch(f.local, { signal: AbortSignal.timeout(2000) }); assert.equal(response.status, 200); await assert.rejects(response.text()); assert.equal(f.calls.length, 1); }
  finally { await transport.close(); await f.close(); }
});

for (const failure of ['goaway', 'socket-close']) test(`concurrent H2 ${failure} rejects each request once and completes cleanup`, async () => {
  const f = await tlsFixture(stream => {
    if (failure === 'goaway') stream.session.goaway(h2.NGHTTP2_INTERNAL_ERROR);
    else stream.session.destroy();
  }), transport = f.transport();
  try {
    const rows = await Promise.allSettled(['/one', '/two', '/three'].map(path =>
      transport.fetch(f.local + path, { signal: AbortSignal.timeout(2000) })));
    assert(rows.every(row => row.status === 'rejected'));
    assert.equal(f.calls.length, 3);
    assert.equal(new Set(f.calls.map(row => row.path)).size, 3);
  } finally { await transport.close(); await f.close(); }
});

test('trusted CA cannot bypass a mismatched TLS hostname', async () => {
  const f = await tlsFixture(stream => { stream.respond({ ':status': 200 }); stream.end('must-not-load'); }, 'wrong.example'), transport = f.transport();
  try {
    await assert.rejects(transport.fetch(f.local, { signal: AbortSignal.timeout(2000) }), error => error.cause?.code === 'ERR_TLS_CERT_ALTNAME_INVALID');
    assert.equal(f.calls.length, 0);
  } finally { await transport.close(); await f.close(); }
});
