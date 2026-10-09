import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {runCandidateBrowserSmoke,verifyReadOnlyClientInteraction} from '../../scripts/cloudflare/run-candidate-browser-smoke.mjs';
import {runProductionBrowserSmoke,installProductionMutationGate} from '../../scripts/cloudflare/run-production-browser-smoke.mjs';
import {versionOverrideHeader} from '../../scripts/cloudflare/candidate-release-contract.mjs';
import {profile,verifyPinnedReleaseBrowser} from '../../scripts/cloudflare/verify-pinned-release-browser.mjs';
import {nativeProcessArchitecture} from '../../scripts/cloudflare/chromium8508456-gate-ci.mjs';
import {installReaderObserver} from '../../scripts/cloudflare/chromium8508456-reader-observer.mjs';
import {createRecorder} from './recorder.mjs';
import {createRscFixture} from './rsc-fixture.mjs';
import {assetTrace} from './asset-trace.mjs';
import {createHostEvidence} from './host-evidence.mjs';
import {isolateCommunityView} from './community-view-fixture.mjs';
const dir='.wrangler/f02-pr212-final-validation',origin='https://www.locally-travel.com',workerName='locally-web-opennext-production';
const [category,mode,label]=process.argv.slice(2);assert(['preflight','browser','host-direct','host-client'].includes(category));assert(['baseline','candidate'].includes(mode));assert(/^[a-z0-9-]+$/.test(label));
const candidate=JSON.parse(await readFile(dir+'/candidate.json','utf8')),versionId=mode==='baseline'?'7e708856-9cf7-41f4-9b99-6401a516c7d2':candidate.versionId;
const executable=process.env.PLAYWRIGHT_EXECUTABLE_PATH;const identity=await verifyPinnedReleaseBrowser(executable);
const source=JSON.parse(await readFile(dir+'/source.json','utf8'));assert.equal((await import('node:child_process')).execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source.validationHead??source.main);const runStarted=new Date().toISOString();
const authorizedGateChanges=new Set(['scripts/cloudflare/run-candidate-browser-smoke.mjs','scripts/cloudflare/run-production-browser-smoke.mjs','scripts/cloudflare/candidate-release-contract.mjs']);
for(const [p,h] of Object.entries(source.protectedSourceSHA256).filter(([p])=>!authorizedGateChanges.has(p)))assert.equal(createHash('sha256').update(await readFile(p)).digest('hex'),h,'Protected source changed');
const gateSourceSHA256=JSON.parse(await readFile(dir+'/evidence/merged-final-gate-source.json','utf8'));for(const [path,hash] of Object.entries(gateSourceSHA256))assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'),hash,'Merged tested source mismatch');
const expected=JSON.parse(await readFile(dir+'/evidence/expected.json','utf8'));
const fixture=JSON.parse(await readFile('.wrangler/f02-pr212-final-validation/evidence/baseline-fixture-complete.json','utf8'));assert.equal(fixture.versionId,'7e708856-9cf7-41f4-9b99-6401a516c7d2');const baselineAssets=new Map(fixture.rows.map(r=>[r.pathname,r]));
const trace=assetTrace({origin,versionId,evidencePath:dir+'/evidence/'+label+'-asset-transport.json',assetPath:p=>{if(mode==='candidate')return '.open-next/assets'+p;assert(baselineAssets.has(p),'Missing exact baseline asset reference');return baselineAssets.get(p).file}});
let recorder,rsc,result,error,processIdentity,browser,context,gate,hostEvidence,extraDone=false;const readerFacts=[],additionalPages=[];let isolatedCommunityViews=[];
async function attach(c){
 const cd=await c.browser().newBrowserCDPSession();try{const v=await cd.send('Browser.getVersion');assert.equal(v.product,'Chrome/'+profile.browserVersion);assert.equal(v.revision,profile.browserRevision);processIdentity={product:v.product,revision:v.revision,architecture:await nativeProcessArchitecture(c.browser()),executablePath:executable};}finally{await cd.detach()}
 assert.equal((await c.cookies()).length,0);isolatedCommunityViews=await isolateCommunityView(c,origin,expected.eligibleCommunity[0].id);await c.addInitScript(installReaderObserver);recorder=await createRecorder(c,origin,versionId);rsc=createRscFixture({context:c,origin,versionId,record:recorder.record,screenshotPath:dir+'/evidence/'+label+'-experience.png'});
}
async function captureReaders(p){
 const facts=await p.evaluate(()=> (window.__rscReaderFacts??[]).filter(f=>f.rsc).map(({url,...f})=>({...f,pathname:new URL(url).pathname})));readerFacts.push({pagePath:new URL(p.url()).pathname,facts});
}
async function ensureLogin(p){await p.waitForURL(u=>u.pathname==='/login',{timeout:30000,waitUntil:'domcontentloaded'});await p.locator('[data-testid="login-modal"] input:visible').first().waitFor({state:'visible',timeout:45000});}
async function additional(c,options){
 const rows=[['/host/dashboard',ensureLogin],['/account',ensureLogin],[new URL(expected.eligibleCommunity[0]?'https://www.locally-travel.com/community/'+expected.eligibleCommunity[0].id:expected.urls.find(u=>u.includes('/community/'))).pathname,async p=>{await p.locator('h1:visible').first().waitFor({state:'visible',timeout:15000});await p.locator('[data-testid="community-comments-panel"]').waitFor({state:'visible',timeout:15000})}],[new URL(expected.urls.find(u=>u.includes('/users/'))).pathname,async p=>{await p.locator('h1:visible').first().waitFor({state:'visible',timeout:15000});await p.getByTestId('public-host-experiences-section').waitFor({state:'visible',timeout:15000})}]];
 for(const [path,check] of rows){
  const p=await c.newPage();await recorder.watch(p);const errors=[],consoles=[];
  p.on('pageerror',e=>errors.push(e.name));p.on('console',m=>{if(m.type()==='error'&&(!m.location().url||new URL(m.location().url).origin===origin))consoles.push(createHash('sha256').update(m.text()).digest('hex'))});
  try{const response=await p.goto(origin+path,{waitUntil:'domcontentloaded',timeout:30000});assert.equal(response.status(),200);await check(p);await p.waitForTimeout(750);await options.collectReadOnlyPageEvidence(p);await captureReaders(p);options.assertAdditionalSafety();assert.deepEqual(errors,[]);assert.deepEqual(consoles,[]);additionalPages.push({requested:path,status:200,finalPath:new URL(p.url()).pathname,anonymous:true});}finally{await p.close()}
 }

}
try{
 if(['preflight','browser'].includes(category)){
  const runner=(o,options)=>runProductionBrowserSmoke(o,{...options,observeContext:async c=>{
   await attach(c);options.versionOverride.onTransport=recorder.onTransport;const apply=options.versionOverride.onApplied;options.versionOverride.onApplied=(r,q)=>{rsc.onApplied(r,q);recorder.onApplied(r,q);apply(r,q)};await options.observeContext(c);
  },collectReadOnlyPageEvidence:async p=>{await recorder.watch(p);recorder.record('source-collector-start',{pathname:new URL(p.url()).pathname});await options.collectReadOnlyPageEvidence(p);recorder.record('source-collector-done',{pathname:new URL(p.url()).pathname});await captureReaders(p);recorder.record('reader-capture-done',{pathname:new URL(p.url()).pathname});if(category==='preflight'&&!extraDone&&new URL(p.url()).pathname==='/'){extraDone=true;await additional(p.context(),options)}if(new URL(p.url()).pathname==='/login'){recorder.record('login-screenshot-start',{pathname:'/login'});await p.screenshot({path:dir+'/evidence/'+label+'-anonymous-login.png'});recorder.record('login-screenshot-done',{pathname:'/login'});}},log:s=>recorder.record('page-attempt',{receipt:JSON.parse(s)})});
  result=await runCandidateBrowserSmoke({origin,mode:'override',workerName,versionId},{runSmoke:runner,fetchImplementation:trace.fetch,readAsset:trace.readAsset,verifyInteraction:p=>rsc.verifyInteraction(p)});
 }else{
  browser=await chromium.launch({headless:true,executablePath:executable});context=await browser.newContext({serviceWorkers:'block'});let applied;
  hostEvidence=createHostEvidence({context,origin,override:versionOverrideHeader(workerName,versionId),readAsset:trace.readAsset});gate=await installProductionMutationGate(context,origin,{versionOverride:{workerName,versionId,onTransport:(r,q)=>recorder?.onTransport(r,q),onReadResponse:hostEvidence.onReadResponse,onApplied:(r,q)=>applied?.(r,q)}});await attach(context);applied=(r,q)=>{rsc.onApplied(r,q);recorder.onApplied(r,q)};
  const probe=await fetch(origin+'/.well-known/locally-release',{redirect:'error',signal:AbortSignal.timeout(10000),headers:{'X-Locally-Release-Probe':'1','Cloudflare-Workers-Version-Overrides':versionOverrideHeader(workerName,versionId)}});assert.equal(probe.status,204);assert.equal(probe.headers.get('x-locally-worker-version'),versionId);recorder.record('version-probe',{status:204,versionId});
  const p=await context.newPage();await recorder.watch(p);const navigationBegan=Date.now();const response=await p.goto(origin+(category==='host-direct'?'/host/dashboard':'/'),{waitUntil:'domcontentloaded',timeout:30000});assert.equal(response.status(),200);
  if(category==='host-client'){await verifyReadOnlyClientInteraction(p);await p.waitForFunction(()=>typeof window.next?.router?.push==='function',{},{timeout:15000});await p.evaluate(()=>window.next.router.push('/host/dashboard'));}
  await ensureLogin(p);await p.waitForLoadState('load',{timeout:Math.max(1,navigationBegan+30000-Date.now())});await p.waitForTimeout(750);const hostReceipts=await hostEvidence.collect(p);await captureReaders(p);await p.screenshot({path:dir+'/evidence/'+label+'-anonymous-login.png'});assert.equal(gate.blockedUnexpectedWrites.length,0);assert.equal(gate.blockedUnexpectedExternalWrites.length,0);result={status:'HOST_ANONYMOUS_LOGIN_BOUNDARY_PASS',finalPath:'/login',unexpectedBusinessWrites:0,anonymousReadHeaders:gate.anonymousReadHeaders,hostReceipts};await p.close();result.hostFinal=hostEvidence.final();
 }
}catch(e){error={operation:/^[a-zA-Z]+\.[a-zA-Z]+$/.test((e.message??'').split(':')[0])?(e.message??'').split(':')[0]:null,localCallsites:(e.stack??'').split('\n').filter(l=>/^\s+at /.test(l)&&/scripts\/cloudflare|\.wrangler\/f02-pr212-final-validation/.test(l)).map(l=>l.match(/(?:scripts\/cloudflare|\.wrangler\/f02-pr212-final-validation)\/[^ :()]+:\d+:\d+/)?.[0]).filter(Boolean),code:e.code??e.name,cacheStage:e.cacheStage,cacheCaptureEvidence:e.cacheCaptureEvidence,cacheContractEvidence:e.cacheContractEvidence,requestFailures:e.requestFailures,assetEvidence:e.assetEvidence,coverageEvidence:e.coverageEvidence,captureFailures:e.captureFailures,safetyCounts:e.safetyCounts,interactionFailure:e.interactionFailure,messageSHA256:createHash('sha256').update(e.message??'').digest('hex')};}
finally{if(context)await context.close();if(browser)await browser.close();await trace.close()}
const network=recorder?.snapshot(),rscRows=await rsc?.finish();
const failures=network?.requests.filter(q=>q.failure&&['GET','HEAD','OPTIONS'].includes(q.method))??[];
const identityAborts=failures.filter(q=>q.method==='GET'&&q.mainDocument&&q.type==='document'&&!q.queryDigest&&q.pathname==='/.well-known/locally-release'&&q.status===204&&q.failure.failure==='net::ERR_ABORTED');
const teardown=failures.filter(q=>q.failure.afterExplicitTeardown&&q.failure.failure==='net::ERR_ABORTED');
const active=failures.filter(q=>!identityAborts.includes(q)&&!teardown.includes(q));
const allConsoles=network?.events.filter(e=>e.event==='console-error'&&!e.afterTeardown&&(!e.location?.origin||e.location.origin===origin))??[],pages=network?.events.filter(e=>e.event==='pageerror')??[];
const expectedAuth401Consoles=allConsoles.filter(e=>e.location?.pathname==='/api/proxy-bookings'&&e.messageDigest==='2dab3b3c098b940436be243827bea41a08b26ae85d473d0d24e77c3ce5af9718'&&network.requests.some(q=>q.pageId===e.pageId&&q.method==='GET'&&q.mainDocument&&q.type==='document'&&!q.queryDigest&&q.pathname==='/api/proxy-bookings'&&q.status===401));
const consoles=allConsoles.filter(e=>!expectedAuth401Consoles.includes(e));
const nativeRsc=rscRows?.filter(r=>r.verdict==='PASS').map(r=>({id:r.id,pathname:r.pathname,status:r.status,bodyBytes:r.bodyBytes,bodySHA256:r.bodySha256,requestFinished:network.requests.some(q=>q.pathname===r.pathname&&q.flags.rsc&&q.finishedMs!==undefined),cdpLoadingFinished:network.cdpRequests.some(q=>q.pathname===r.pathname&&q.flags.rsc&&q.loadingFinished),originalReaderEOF:readerFacts.some(group=>group.facts.some(f=>f.pathname===r.pathname&&f.channels.some(c=>c.eof&&!c.error&&c.bytes===r.bodyBytes)))}))??[];
if(!error&&(active.length||consoles.length||pages.length))error={code:'UNEXPECTED_PRETEARDOWN_FAILURE'};
if(!error&&['preflight','browser'].includes(category)&&!result.attempts.every(a=>a.pass&&!a.timeout))error={code:'VALIDATION_EPOCH_CONTAINS_FAILED_OR_RETRIED_ATTEMPT'};
if(!error&&['preflight','browser'].includes(category)&&!nativeRsc.some(r=>r.pathname.startsWith('/experiences/')&&r.requestFinished&&r.cdpLoadingFinished&&r.originalReaderEOF))error={code:'NATIVE_RSC_TERMINAL_OR_EOF_NOT_VERIFIED'};
const out={fixtureSHA256:createHash('sha256').update(await readFile(import.meta.filename)).digest('hex'),sourceMain:source.main,runStarted,runEnded:new Date().toISOString(),gateSourceSHA256,label,category,mode,versionId,verdict:error?'FAIL':'PASS',error,identity,processIdentity,protectedApplicationUnchanged:true,gateStatus:process.env.F02_GATE_STATUS??'MERGED_MAIN_READONLY_VALIDATION',auth:'stateless-anonymous',result,additionalPages,isolatedCommunityViews,nativeRsc,readerFacts,requestFailureCount:failures.length,identityNoContentAborts:identityAborts.length,postTeardownCancels:teardown.length,unexplainedPreTeardownFailures:active.length,consoleErrors:consoles.length,expectedAuth401ConsoleCount:expectedAuth401Consoles.length,pageErrors:pages.length,network,rscRows};
await writeFile(dir+'/evidence/'+label+'.json',JSON.stringify(out,null,2),{mode:0o600,flag:'wx'});
console.log(JSON.stringify({label,versionId,verdict:out.verdict,error,nativeRsc,requestFailureCount:failures.length,postTeardownCancels:teardown.length,activeFailureCount:active.length,consoleErrors:consoles.length,expectedAuth401ConsoleCount:expectedAuth401Consoles.length,pageErrors:pages.length,assets:result?.assetResponses?.length,additionalPages}));if(error)process.exitCode=1;
