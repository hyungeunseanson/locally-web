import {AsyncLocalStorage} from 'node:async_hooks';
import diagnostics from 'node:diagnostics_channel';
import {createHash} from 'node:crypto';
import {writeFile,readFile} from 'node:fs/promises';
const allowed=['cf-ray','cf-cache-status','age','content-length','content-type','content-encoding','etag','cache-control','server-timing'];
const hash=b=>createHash('sha256').update(b).digest('hex');
const safeError=e=>({name:e?.name??null,code:e?.code??null,causeName:e?.cause?.name??null,causeCode:e?.cause?.code??null});
const kind=p=>p.endsWith('.woff2')?'font':p.endsWith('.css')?'css':p.endsWith('.js')?'js':'other';
export function assetTrace({origin,versionId,evidencePath,phase='direct-proof',fetchImpl=fetch,assetPath=pathname=>'.open-next/assets'+pathname}){
 const rows=[],connections=[],als=new AsyncLocalStorage(),requests=new WeakMap(),subscriptions=[],socketIds=new WeakMap();let sequence=0,socketCount=0;
 const emit=(name,fn)=>{const ch=diagnostics.channel(name);const wrapped=data=>{try{fn(data)}catch{}};ch.subscribe(wrapped);subscriptions.push([ch,wrapped]);};
 const at=row=>Math.round(performance.now()-row.started);
 emit('undici:request:create',({request})=>{const r=als.getStore();if(r){requests.set(request,r);r.requestCreatedMs=at(r)}});
 emit('undici:client:sendHeaders',({request,socket})=>{const r=requests.get(request);if(r){r.requestSentMs=at(r);if(!socketIds.has(socket))socketIds.set(socket,++socketCount);r.socket={id:socketIds.get(socket),remotePort:socket.remotePort,remoteAddress:socket.remoteAddress,remoteFamily:socket.remoteFamily,alpn:socket.alpnProtocol??null,tlsAuthorized:socket.authorized??null,sessionReused:socket.isSessionReused?.()??null}}});
 emit('undici:request:headers',({request,response})=>{const r=requests.get(request);if(r){r.headerArrivedMs=at(r);r.status=response.statusCode}});
 emit('undici:request:bodyChunkReceived',({request,chunk})=>{const r=requests.get(request);if(r){r.wireBytes=(r.wireBytes??0)+chunk.length;r.chunks=(r.chunks??0)+1;if(r.firstBodyChunkMs===undefined)r.firstBodyChunkMs=at(r);r.lastBodyChunkMs=at(r);(r.chunkReceipts??=[]).push({ms:r.lastBodyChunkMs,bytes:chunk.length,cumulativeBytes:r.wireBytes})}});
 emit('undici:request:trailers',({request})=>{const r=requests.get(request);if(r)r.transportCompleteMs=at(r)});
 emit('undici:request:error',({request,error})=>{const r=requests.get(request);if(r)r.transportError={...safeError(error),ms:at(r)}});
 emit('undici:client:beforeConnect',({connectParams})=>{if(connectParams.hostname===new URL(origin).hostname)connections.push({event:'beforeConnect',timestamp:new Date().toISOString(),hostname:connectParams.hostname,protocol:connectParams.protocol})});
 emit('undici:client:connected',({connectParams,socket})=>{if(connectParams.hostname===new URL(origin).hostname)connections.push({event:'connected',timestamp:new Date().toISOString(),remoteAddress:socket.remoteAddress,remoteFamily:socket.remoteFamily,alpn:socket.alpnProtocol??null,tlsAuthorized:socket.authorized??null})});
 emit('undici:client:connectError',({connectParams,error})=>{if(connectParams.hostname===new URL(origin).hostname)connections.push({event:'connectError',timestamp:new Date().toISOString(),...safeError(error)})});
 const sanitized=()=>rows.map(row=>{const r={...row};delete r.started;delete r.signal;return {...r,abortSignal:{aborted:row.signal?.aborted??false,reason:row.signal?.aborted?safeError(row.signal.reason):null}}});
 let chain=Promise.resolve();const save=()=>{const content=JSON.stringify({origin,versionId,phase,diagnosticPolicy:'Original 10000ms redirect:error; no retries; allowlisted headers only; connection events are process-wide and not attributed to a particular request.',rows:sanitized(),connections},null,2);chain=chain.then(()=>writeFile(evidencePath,content,{mode:0o600}));return chain;};
 const wrapped=async(url,options={})=>{
  const u=new URL(url);if(u.origin!==origin||!u.pathname.startsWith('/_next/static/'))return fetchImpl(url,options);
  const r={id:++sequence,pathname:u.pathname,targetVersion:versionId,assetType:kind(u.pathname),startTimestamp:new Date().toISOString(),started:performance.now(),signal:options.signal,phase,stage:'request-headers',headersReceived:false,bodyComplete:false,redirectPolicy:options.redirect,method:options.method??'GET'};rows.push(r);
  return als.run(r,async()=>{try{const response=await fetchImpl(url,options);r.headersReceived=true;r.fetchResolvedMs=at(r);r.status=response.status;r.redirected=response.redirected;if(response.status!==200||response.redirected){r.failureStage='http-status-or-redirect';r.totalElapsedMs=at(r)}r.headers=Object.fromEntries(allowed.map(h=>[h,response.headers.get(h)]).filter(([,v])=>v!==null));r.expectedWireBytes=r.headers['content-length']?Number(r.headers['content-length']):null;
   const ab=response.arrayBuffer.bind(response);response.arrayBuffer=async()=>{r.stage='response-body';r.bodyReadStartMs=at(r);try{const bytes=await ab();r.receivedBytes=bytes.byteLength;r.remoteSHA256=hash(Buffer.from(bytes));r.bodyComplete=true;r.bodyReadEndMs=at(r);r.bodyReadElapsedMs=r.bodyReadEndMs-r.bodyReadStartMs;r.totalElapsedMs=at(r);r.stage='remote-complete';await save();return bytes;}catch(e){r.failureStage='response-body';r.exception=safeError(e);r.totalElapsedMs=at(r);await save();throw e}};await save();return response;
  }catch(e){if(!r.failureStage){r.failureStage='request-headers';r.exception=safeError(e);r.totalElapsedMs=at(r);await save()}throw e}});
 };
 const localReader=async pathname=>{const r=[...rows].reverse().find(r=>r.pathname===pathname&&r.bodyComplete&&!r.localRead);const start=performance.now();try{const bytes=await readFile(assetPath(pathname));if(r){r.localRead={result:'PASS',elapsedMs:Math.round(performance.now()-start),bytes:bytes.length,sha256:hash(bytes)};r.hashMatch=r.remoteSHA256===r.localRead.sha256;if(!r.hashMatch)r.failureStage='sha256-compare';r.totalElapsedMs=at(r);await save()}return bytes}catch(e){if(r){r.failureStage='local-asset-read';r.localRead={result:'FAIL',elapsedMs:Math.round(performance.now()-start),exception:safeError(e)};r.totalElapsedMs=at(r);await save()}throw e}};
 return {fetch:wrapped,readAsset:localReader,rows,sanitized,save,close:async()=>{await save();for(const[ch,fn]of subscriptions)ch.unsubscribe(fn)}};
}
