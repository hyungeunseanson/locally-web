import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const runtime=process.argv[process.argv.indexOf('--runtime')+1];
if(!runtime || runtime===process.argv[0]) throw Error('Pass --runtime with pinned embedded-postgres/pg/esbuild dependencies');
const require=createRequire(resolve(runtime,'package.json'));
const EP=require('embedded-postgres');const EmbeddedPostgres=EP.default||EP;
const {build}=createRequire(root+'/package.json')('esbuild');
const nativeFetch=globalThis.fetch;
const localFetch=(input,init)=>{const url=new URL(String(input));assert.equal(url.hostname,'127.0.0.1');url.pathname=url.pathname.replace(/^\/rest\/v1/,'');return nativeFetch(url,init);};
require(resolve(root,'tests/fixtures/targeted-card-closeout/network-guard.cjs'));
const fixture=resolve(root,'tests/fixtures/targeted-card-closeout');
const temp=await mkdtemp('/tmp/locally-targeted-closeout-');
const netServer=createServer();await new Promise(r=>netServer.listen(0,'127.0.0.1',r));
const port=netServer.address().port;await new Promise(r=>netServer.close(r));
const db=new EmbeddedPostgres({databaseDir:temp+'/pg',user:'postgres',password:'synthetic-only',port,
 persistent:false,postgresFlags:['-c','listen_addresses=127.0.0.1'],onLog:()=>{},onError:()=>{}});
const clients=[];let checks=0;let restServer;
const check=(name)=>{checks++;console.log(JSON.stringify({name,pass:true}));};
const A='ORD-20261008232253248-691',B='ORD-20261008232336792-577',C='ORD-20261009014356883-813';
const user='11111111-1111-4111-8111-111111111111';
const evidence={decision:'operational_incomplete',runtime_mid_matches_admin:true,approval_fence_deployed:true,old_workers_drained:true,alternate_worker_paths_blocked:true,financial_visibility_verified:true,legacy_rpc_409_commit_verified:true,deployment_reference:'synthetic-version',reference:'synthetic-local-test'};
let calls=0,lastRefund='',failNextName=null;
const legacyRevision=process.env.TARGETED_LEGACY_REVISION || '2ffeb8c3ea58b274bef0407d3b5175494944520f';
assert.ok(['2ffeb8c3ea58b274bef0407d3b5175494944520f','e4933ce1c00707b792e69911a0791726a6a7e956'].includes(legacyRevision),'Only reviewed F01/F02 legacy source may be tested');
const legacyLabel=legacyRevision==='e4933ce1c00707b792e69911a0791726a6a7e956'?'F02':'F01';
let notifications=0,adminEmails=0;
try{
 await db.initialise();await db.start();
 for(let i=0;i<3;i++){const c=db.getPgClient('postgres','127.0.0.1');await c.connect();clients.push(c);}
 const c=clients[0];await c.query("CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE SCHEMA extensions;CREATE SCHEMA private;CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role') $$;CREATE FUNCTION extensions.gen_random_uuid() RETURNS uuid LANGUAGE sql AS $$ SELECT pg_catalog.gen_random_uuid() $$;");
 for(const conn of clients)await conn.query("SELECT set_config('request.jwt.claim.role','service_role',false)");
 const schema=JSON.parse(await readFile(fixture+'/schema.json','utf8'));
 const defaults={created_at:'now()',amount:'0',order_id:"''",status:"'PENDING'",payment_method:"'card'",refund_amount:'0',host_payout_amount:'0',platform_revenue:'0',payout_status:"'pending'",price_at_booking:'0',total_experience_price:'0',is_solo_guarantee:'false',solo_guarantee_price:'0',solo_guarantee_refund_status:"'not_applicable'",solo_guarantee_refund_amount:'0'};
 const fields=t=>schema.filter(x=>x.table_name===t).map(x=>'"'+x.column_name+'" '+(x.data_type==='ARRAY'?'text[]':x.data_type)+(x.column_name==='id'?' PRIMARY KEY':'')+(defaults[x.column_name]!==undefined?' DEFAULT '+defaults[x.column_name]:'')).join(',');
 await c.query('CREATE TABLE bookings('+fields('bookings')+');CREATE TABLE booking_solo_refund_operations('+fields('booking_solo_refund_operations')+');CREATE TABLE booking_solo_refund_attempts('+fields('booking_solo_refund_attempts')+");CREATE TABLE experiences(id bigint PRIMARY KEY,host_id uuid,title text,price numeric,private_price numeric,max_guests integer,solo_guarantee_price integer,duration integer);CREATE TABLE service_bookings(tid text);CREATE TABLE proxy_requests(tid text);");
 await c.query(await readFile(fixture+'/baseline.sql','utf8'));
 await c.query('CREATE TRIGGER bookings_money_transition_authority BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION private.guard_booking_money_transition();CREATE TRIGGER bookings_payment_claim_columns_server_only BEFORE INSERT OR UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION guard_experience_payment_claim_columns();');
 const migration=await readFile(root+'/docs/financial/installed/20261009035059_targeted_nicepay_ab_closeout.sql','utf8');
 await c.query(migration);
 await c.query(await readFile(root+'/supabase/migrations/20261011000100_experience_nicepay_recovery.sql','utf8'));
 // Install the existing cancellation/payout authorities verbatim; no substitute locks.
 const financialSql=await readFile(root+'/supabase/migrations/20261005104924_solo_guarantee_financial_authority.sql','utf8');
 const dueStart=financialSql.indexOf('CREATE OR REPLACE FUNCTION private.solo_refund_due(');
 await c.query(financialSql.slice(dueStart,financialSql.indexOf('CREATE OR REPLACE FUNCTION private.assert_booking_payout_safe',dueStart)));
 for(const name of ['claim_booking_cancellation_atomic','finalize_booking_cancellation_atomic','settle_experience_payouts_atomic']){
  const start=financialSql.indexOf('CREATE OR REPLACE FUNCTION public.'+name+'(');
  assert.ok(start>=0);const end=financialSql.indexOf('END $$;',start)+7;
  await c.query(financialSql.slice(start,end));
 }
 const safeConfirm=migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.confirm_experience_payment_atomic'),migration.indexOf('NOTIFY pgrst'));

 await c.query("INSERT INTO experiences VALUES(4659,$1,'Synthetic',42000,126000,4,42000,3)",[user]);
 const reset=async()=>{
  failNextName=null;calls=0;lastRefund='';
  await c.query('TRUNCATE service_bookings,proxy_requests');
  await c.query('TRUNCATE private.targeted_card_notifications,private.targeted_card_events,private.targeted_card_recovery,private.targeted_card_closeouts,bookings CASCADE;');
  for(const id of [A,B,C]) await c.query("INSERT INTO bookings(id,order_id,user_id,experience_id,date,time,type,guests,amount,total_price,status,payment_claim_state,payment_provider,payment_provider_reference,tid,host_payout_amount,platform_revenue,created_at) VALUES($1,$1,$2,4659,'2026-10-15','12:00','group',1,46200,42000,$3,$4,'nicepay',$1,$5,$6,$7,now()-interval '4 hours')",
  [id,user,id===C?'PAID':'PENDING',id===C?'completed':'reconciliation_required',id===C?'SYNTHETIC-C-TID':null,id===C?33600:0,id===C?12600:0]);
 };
 const row=async(id)=>(await c.query('SELECT * FROM bookings WHERE id=$1',[id])).rows[0];
 const fingerprint=async()=>crypto.createHash('md5').update((await c.query('SELECT to_jsonb(b)::text value FROM bookings b WHERE id=$1',[C])).rows[0].value).digest('hex');
 const close=async()=>c.query('SELECT public.close_targeted_card_attempts_atomic($1,$2,$3) data',['synthetic-operator',await fingerprint(),evidence]);
 const remaining=async()=>Number((await c.query("SELECT 4-coalesce(sum(guests) FILTER(WHERE lower(status) IN ('pending','paid','confirmed')),0) remaining FROM bookings WHERE experience_id=4659 AND date='2026-10-15' AND time='12:00'")).rows[0].remaining);
 const adapter=(conn=c)=>({rpc(name,args){
  const request=(async()=>{
   if(failNextName===name){failNextName=null;return {data:null,error:{message:'SYNTHETIC_DB_FAILURE'}};}
   const keys=Object.keys(args);const q='SELECT public.'+name+'('+keys.map((k,i)=>k+' => $'+(i+1)).join(',')+') data';
   try{return {data:(await conn.query(q,Object.values(args))).rows[0]?.data ?? null,error:null};}
   catch(e){return {data:null,error:{message:e.message,code:e.code}};}
  })();
  // Actual Supabase maybeSingle() returns NULL data without error on zero rows.
  request.maybeSingle=async()=>{const r=await request;return {data:r.data==null?null:{outcome:r.data},error:r.error};};
  return request;
 }});
 const queryAdapter=()=>({...adapter(),from(table){
  assert.equal(table,'bookings');const filters=[];
  return {select(){return this;},eq(key,value){assert.ok(['id','order_id','tid'].includes(key));filters.push([key,value]);return this;},
   async maybeSingle(){return {data:(await c.query('SELECT * FROM bookings WHERE '+filters.map(([k],i)=>k+'=$'+(i+1)).join(' AND '),filters.map(([,v])=>v))).rows[0]||null,error:null};}};
 }});
 await build({stdin:{contents:"export * from './app/utils/payments/card/server.ts';export * from './app/utils/payments/card/targetedNicePayCloseout.ts';export * from './app/utils/payments/card/targetedCloseoutTargets.ts';",resolveDir:root,loader:'ts'},
 outfile:temp+'/helpers.cjs',bundle:true,platform:'node',format:'cjs',packages:'external',tsconfig:root+'/tsconfig.json',
 plugins:[{name:'no-external-provider',setup(b){b.onResolve({filter:/portone\/server|server-only/},a=>({path:a.path,namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:"export function getPortOnePayment(){throw new Error('FORBIDDEN');}export function isPortOneCardReady(){return false;}",loader:'js'}));}}]});
 const m=require(temp+'/helpers.cjs');process.env.NICEPAY_MID='audit0000m';process.env.NICEPAY_MERCHANT_KEY='SYNTHETIC_KEY';
 process.env.CARD_PAYMENT_PROVIDER='nicepay';
 const routeStubs={
  'next/server':`export class NextResponse extends Response { static json(data,init){return new NextResponse(JSON.stringify(data),{...init,headers:{'content-type':'application/json'}});} }`,
  '@/app/utils/supabase/admin':`export const createAdminClient=()=>globalThis.__targetedAdmin;`,
  '@/app/utils/supabase/server':`export const createClient=async()=>({auth:{getUser:async()=>({data:{user:globalThis.__targetedAuth===undefined?{id:'${user}'}:globalThis.__targetedAuth},error:null})}});`,
  '@/app/utils/monitoring/sentry':`export function captureServerException(){}`,
  '@/app/utils/adminAlertCenter':`export async function insertAdminAlerts(){} export async function sendAdminAlertEmails(){} export async function sendAdminPaymentConfirmedEmail(){globalThis.__adminEmail();}`,
  'next/cache':`export function revalidatePath(){}`,
  '@/app/utils/experienceNotificationFlows':`export async function notifyExperiencePaymentConfirmed(){globalThis.__notification();}`,
  '@/app/api/proxy-bookings/payment/proxyCardConfirmation':`export async function finalizeProxyCardPayment(){throw new Error('FORBIDDEN_PROXY');}`,
  '@/app/api/services/payment/serviceCardConfirmation':`export async function finalizeServiceCardPayment(){throw new Error('FORBIDDEN_SERVICE');}`,
 };
 await build({stdin:{contents:"export * from './app/api/payment/experienceCardConfirmation.ts';export * from './app/api/payment/cardNotificationHandler.ts';export {POST as callbackPOST} from './app/api/payment/nicepay-callback/route.ts';",resolveDir:root,loader:'ts'},
  outfile:temp+'/routes.cjs',bundle:true,platform:'node',format:'cjs',packages:'external',tsconfig:root+'/tsconfig.json',
  plugins:[{name:'isolated-route-dependencies',setup(b){b.onResolve({filter:/.*/},a=>{
   if(routeStubs[a.path])return {path:a.path,namespace:'route-stub'};
   if(/portone\/server|server-only/.test(a.path))return {path:a.path,namespace:'provider-stub'};
  });b.onLoad({filter:/.*/,namespace:'route-stub'},a=>({contents:routeStubs[a.path],loader:'js'}));
   b.onLoad({filter:/.*/,namespace:'provider-stub'},()=>({contents:"export function getPortOnePayment(){throw new Error('FORBIDDEN');}export function isPortOneCardReady(){return false;}",loader:'js'}));}}]});
 const routes=require(temp+'/routes.cjs');globalThis.__targetedAdmin=queryAdapter();globalThis.__notification=()=>notifications++;globalThis.__adminEmail=()=>adminEmails++;
 const legacyPaths=['app/api/payment/experienceCardConfirmation.ts','app/api/payment/cardNotificationHandler.ts','app/utils/payments/card/server.ts','app/api/payment/nicepay-callback/route.ts','app/utils/bookings/confirmExperiencePayment.ts','app/utils/bookings/experiencePaymentClaims.ts'];
 const legacySources=Object.fromEntries(legacyPaths.map(file=>[resolve(root,file),execFileSync('git',['show',legacyRevision+':'+file],{cwd:root,encoding:'utf8'})]));
 await build({stdin:{contents:"export * from './app/api/payment/experienceCardConfirmation.ts';export * from './app/api/payment/cardNotificationHandler.ts';export {POST as callbackPOST} from './app/api/payment/nicepay-callback/route.ts';",resolveDir:root,loader:'ts'},
  outfile:temp+'/legacy-routes.cjs',bundle:true,platform:'node',format:'cjs',packages:'external',tsconfig:root+'/tsconfig.json',
  plugins:[{name:'actual-F01-sources-and-external-boundaries',setup(b){
   b.onResolve({filter:/.*/},a=>{if(routeStubs[a.path])return {path:a.path,namespace:'route-stub'};if(/portone\/server|server-only/.test(a.path))return {path:a.path,namespace:'provider-stub'};});
   b.onLoad({filter:/\.ts$/},a=>legacySources[a.path]?{contents:legacySources[a.path],loader:'ts',resolveDir:dirname(a.path)}:undefined);
   b.onLoad({filter:/.*/,namespace:'route-stub'},a=>({contents:routeStubs[a.path],loader:'js'}));
   b.onLoad({filter:/.*/,namespace:'provider-stub'},()=>({contents:"export function getPortOnePayment(){throw new Error('FORBIDDEN');}export function isPortOneCardReady(){return false;}",loader:'js'}));
  }}]});
 const legacyRoutes=require(temp+'/legacy-routes.cjs');
 const payment=(id=A)=>{const tid='SYNTHETIC-TID-'+(id===A?'A':'B'),amt='000000046200';
  return {provider:'nicepay',providerTransactionId:tid,approvedAmount:46200,raw:{ResultCode:'3001',Moid:id,TID:tid,MID:'audit0000m',Amt:amt,PayMethod:'CARD',Signature:crypto.createHash('sha256').update(tid+'audit0000m'+amt+'SYNTHETIC_KEY').digest('hex'),BuyerEmail:'DO_NOT_STORE',AuthToken:'DO_NOT_STORE'}};};
 const mockSuccess=()=>{globalThis.fetch=async(url,options)=>{
  assert.ok(String(url).endsWith('/cancel_process.jsp'));calls++;
  const body=new URLSearchParams(options.body),tid=body.get('TID'),id=body.get('Moid'),amt=body.get('CancelAmt');
  lastRefund=JSON.stringify({ResultCode:'2001',MID:'audit0000m',TID:tid,Moid:id,CancelAmt:amt,CancelNum:'SYNTHETIC-REFUND-1',Signature:crypto.createHash('sha256').update(tid+'audit0000m'+amt+'SYNTHETIC_KEY').digest('hex'),BuyerEmail:'DO_NOT_STORE'});
  return new Response(lastRefund,{status:200});};};

 await reset();await close();

 const {createClient}=createRequire(root+'/package.json')('@supabase/supabase-js');
 const postgrestBinary=process.env.LOCAL_POSTGREST_BINARY;
 assert.ok(postgrestBinary,'Set LOCAL_POSTGREST_BINARY to a local PostgREST executable');
 const netRest=createServer();await new Promise(r=>netRest.listen(0,'127.0.0.1',r));const restPort=netRest.address().port;await new Promise(r=>netRest.close(r));
 restServer=spawn(postgrestBinary,[],{env:{PATH:process.env.PATH,DYLD_LIBRARY_PATH:process.env.DYLD_LIBRARY_PATH,
  PGRST_DB_URI:`postgres://postgres:synthetic-only@127.0.0.1:${port}/postgres`,PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_SERVER_HOST:'127.0.0.1',PGRST_SERVER_PORT:String(restPort),PGRST_DB_TX_END:'commit',PGRST_JWT_SECRET:'synthetic-postgrest-test-secret-32-characters-only',PGRST_LOG_LEVEL:'error'},stdio:'ignore'});
 let ready=false;for(let i=0;i<60;i++){try{if((await localFetch('http://127.0.0.1:'+restPort+'/')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 assert.ok(ready,'Local PostgREST did not start');
 const jwtBody=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({role:'service_role',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
 const syntheticJwt=jwtBody+'.'+crypto.createHmac('sha256','synthetic-postgrest-test-secret-32-characters-only').update(jwtBody).digest('base64url');
 const restClient=createClient('http://127.0.0.1:'+restPort,syntheticJwt,{global:{fetch:localFetch},auth:{persistSession:false,autoRefreshToken:false}});
 // Actual anon and signed authenticated JWTs: never use service_role as anon.
 const jwtForRole=role=>{const body=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({role,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');return body+'.'+crypto.createHmac('sha256','synthetic-postgrest-test-secret-32-characters-only').update(body).digest('base64url');};
 const restRequest=async(name,args,token)=>localFetch('http://127.0.0.1:'+restPort+'/rpc/'+name,{method:'POST',headers:{'content-type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(args)});
 const securedRpcs={
  review_targeted_card_notifications_atomic:{p_booking_id:A,p_through_version:1,p_owner_reference:'spoof',p_case_reference:'spoof'},
  record_targeted_card_notification_atomic:{p_booking_id:A,p_tid:'SYNTHETIC-SPOOF',p_amount:46200,p_payload:{}},
  record_targeted_card_approval_atomic:{p_booking_id:A,p_tid:'SYNTHETIC-SPOOF',p_amount:46200},
  close_targeted_card_attempts_atomic:{p_actor_reference:'spoof',p_c_fingerprint:await fingerprint(),p_evidence:evidence},
  begin_targeted_card_refund_atomic:{p_operation_id:user},
  record_targeted_card_refund_result_atomic:{p_operation_id:user,p_outcome:'accepted',p_proof:{}},
  finalize_targeted_card_refund_atomic:{p_operation_id:user},
  get_targeted_card_ops_snapshot:{},get_targeted_card_recovery_review:{},
  acknowledge_targeted_card_recovery_atomic:{p_operation_id:user,p_owner_reference:'spoof',p_case_reference:'spoof'},
 };
 for(const token of [null,jwtForRole('anon'),jwtForRole('authenticated')])for(const [name,args] of Object.entries(securedRpcs)){
  const response=await restRequest(name,args,token);assert.ok([401,403,404].includes(response.status),name+' unexpectedly accessible '+response.status);
 }
 const malformed=await restRequest('record_targeted_card_approval_atomic',securedRpcs.record_targeted_card_approval_atomic,syntheticJwt.slice(0,-8)+'forgedxx');assert.equal(malformed.status,401);
 assert.equal((await c.query('SELECT count(*) n FROM private.targeted_card_recovery')).rows[0].n,'0');
 assert.equal((await c.query('SELECT count(*) n FROM private.targeted_card_notifications')).rows[0].n,'0');
 check('ACTUAL_POSTGREST_ANON_AUTHENTICATED_ALL_TEN_RPCS_DENIED_INVALID_SERVICE_JWT_DENIED');
 globalThis.__targetedAdmin={...queryAdapter(),rpc:restClient.rpc.bind(restClient)};
 globalThis.__targetedAuth=null;
 let rejected=await routes.callbackPOST(new Request('http://127.0.0.1/api/payment/nicepay-callback',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({orderId:A,approvalId:'synthetic'})}));assert.equal(rejected.status,401);
 globalThis.__targetedAuth={id:'22222222-2222-4222-8222-222222222222'};
 rejected=await routes.callbackPOST(new Request('http://127.0.0.1/api/payment/nicepay-callback',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({orderId:A,approvalId:'synthetic'})}));assert.equal(rejected.status,403);
 globalThis.__targetedAuth=undefined;
 check('PUBLIC_CALLBACK_NO_SESSION_401_OTHER_OWNER_403_BEFORE_PRIVILEGED_FINANCIAL_RPC');
 await reset();const beforeSpoofC=await row(C);
 const postNotification=payload=>routes.handleNicePayCardNotification(new Request('http://127.0.0.1/api/payment/card-notification',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(payload)}),{target:'experience'});
 const spoof={Moid:A,TID:'SYNTHETIC-UNVERIFIED',Amt:'46200',PayMethod:'CARD',StateCd:'1',ResultCode:'3001',Signature:'FAKE_SIGNATURE',BuyerEmail:'DO_NOT_STORE',AuthToken:'DO_NOT_STORE'};
 for(let i=0;i<5;i++){const response=await postNotification(spoof);assert.equal(response.status,200);assert.equal(await response.text(),'OK');}
 const inbox=(await c.query('SELECT * FROM private.targeted_card_notifications')).rows;assert.equal(inbox.length,1);assert.equal(inbox[0].receipt_count,'5');assert.equal(inbox[0].payload.verified,false);assert.ok(!('BuyerEmail' in inbox[0].payload));assert.ok(!('AuthToken' in inbox[0].payload));
 assert.equal((await c.query('SELECT count(*) n FROM private.targeted_card_recovery')).rows[0].n,'0');
 assert.equal((await restRequest('get_targeted_card_ops_snapshot',{},syntheticJwt)).status,200);
 assert.ok((await restClient.rpc('get_targeted_card_ops_snapshot')).data.every(x=>x.diagnostic_code==='targeted_card_notification_a'));
 assert.equal((await restClient.rpc('begin_targeted_card_refund_atomic',{p_operation_id:user})).data,false);
 assert.equal((await close()).rows[0].data.closed_count,2);assert.deepEqual(await row(C),beforeSpoofC);
 assert.equal(await remaining(),3);assert.equal(calls,0);
 // Even a copied valid approval signature remains a notification, never refund authority.
 await postNotification({...spoof,...payment().raw,StateCd:'1',Amt:'46200'});
 assert.equal((await c.query('SELECT count(*) n FROM private.targeted_card_recovery')).rows[0].n,'0');
 check('UNAUTHENTICATED_PUBLIC_SPOOF_AND_SIGNED_NOTIFICATION_INBOX_ONLY_NO_CLOSE_BLOCK_NO_REFUND_AUTHORITY');
 for(const payload of [{...spoof,Amt:'1'},{...spoof,TID:''}])assert.equal((await postNotification(payload)).status,400);
 await reset();await m.recordTargetedNicePayApproval({supabaseAdmin:adapter(),orderId:A,payment:payment()});
 await assert.rejects(close,/TARGETED_CARD_SNAPSHOT_CONFLICT/);assert.equal((await row(B)).status,'PENDING');
 check('SERVER_APPROVAL_EVIDENCE_STILL_BLOCKS_CLOSE_UNVERIFIED_INBOX_NEVER_DOES');
 await reset();await close();globalThis.__targetedAdmin=queryAdapter();
 const originalCBeforeLegacy=await row(C);
 // Booking reload stays synthetic SQL; the confirmation RPC crosses actual HTTP/PostgREST.
 const legacyDb={...queryAdapter(),rpc:restClient.rpc.bind(restClient)};
 const safeBranch="PERFORM pg_catalog.set_config('response.status','409',true);\n    RETURN QUERY SELECT 'targeted_closeout_review_required'::text;";
 const unsafeConfirm=safeConfirm.replace(safeBranch,"RETURN QUERY SELECT 'already_processed'::text;");
 assert.notEqual(unsafeConfirm,safeConfirm);await c.query(unsafeConfirm);
 const falseSuccess=await legacyRoutes.finalizeExperienceCardPayment({supabaseAdmin:legacyDb,originalBooking:await row(A),verificationResult:payment()});
 assert.equal(falseSuccess.success,true);assert.equal(falseSuccess.alreadyProcessed,true);
 assert.equal((await row(A)).status,'cancelled');assert.equal(notifications,0);assert.equal(adminEmails,0);
 check(`PREVIOUS_SQL_ACTUAL_${legacyLabel}_AND_POSTGREST_REPRODUCES_FALSE_CUSTOMER_SUCCESS_NO_EMAIL`);
 // A singular 0-row response actually rolls back writes: prove the rejected alternative.
 const emptyConfirm=safeConfirm.replace(safeBranch,'');await c.query(emptyConfirm);
 const empty=await restClient.rpc('confirm_experience_payment_atomic',{p_booking_id:B,p_provider:'nicepay',p_provider_reference:B,p_provider_transaction_id:'SYNTHETIC-TID-B',p_verified_amount:46200}).maybeSingle();
 assert.equal(empty.data,null);assert.equal(empty.error,null);
 assert.equal((await c.query('SELECT count(*) n FROM private.targeted_card_recovery WHERE booking_id=$1',[B])).rows[0].n,'0');
 check('POSTGREST_ZERO_ROW_SINGULAR_ROLLS_BACK_EVIDENCE_REJECTED_DESIGN');
 await c.query(safeConfirm);
 const safeLegacy=await legacyRoutes.finalizeExperienceCardPayment({supabaseAdmin:legacyDb,originalBooking:await row(B),verificationResult:payment(B)});
 assert.equal(safeLegacy.success,false);assert.equal(safeLegacy.status,409);
 assert.equal((await c.query('SELECT count(*) n FROM private.targeted_card_recovery')).rows[0].n,'2');
 assert.equal(notifications,0);assert.equal(adminEmails,0);assert.deepEqual(await row(C),originalCBeforeLegacy);
 check(`FIXED_SQL_ACTUAL_${legacyLabel}_AND_POSTGREST_RETURNS_409_COMMITS_APPROVALS_NO_EMAIL`);
 const runOldCallbackRace=async(sql)=>{
  await reset();await c.query(sql);globalThis.__targetedAdmin=legacyDb;
  let entered,release;const started=new Promise(r=>entered=r),resume=new Promise(r=>release=r);
  globalThis.fetch=async(url)=>{assert.ok(String(url).endsWith('/pay_process.jsp'));entered();await resume;return new Response(JSON.stringify(payment().raw),{status:200});};
  const authToken='SYNTHETIC_AUTH',amt='000000046200';
  const providerPayload={AuthResultCode:'0000',AuthToken:authToken,TxTid:'SYNTHETIC-TID-A',MID:'audit0000m',Moid:A,Amt:amt,NextAppURL:'https://dc1-api.nicepay.co.kr/webapi/pay_process.jsp',PayMethod:'CARD',Signature:crypto.createHash('sha256').update(authToken+'audit0000m'+amt+'SYNTHETIC_KEY').digest('hex')};
  const responsePromise=legacyRoutes.callbackPOST(new Request('http://127.0.0.1/api/payment/nicepay-callback',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({orderId:A,approvalId:'SYNTHETIC-TID-A',providerPayload})}));
  await Promise.race([started,new Promise((_,reject)=>setTimeout(()=>reject(Error('LEGACY_APPROVAL_NOT_REACHED')),3000))]);
  await close();release();const response=await responsePromise;
  return {status:response.status,body:await response.json()};
 };
 const oldApiResponse=await runOldCallbackRace(unsafeConfirm);assert.equal(oldApiResponse.status,200);assert.equal(oldApiResponse.body.success,true);
 const fixedApiResponse=await runOldCallbackRace(safeConfirm);assert.equal(fixedApiResponse.status,409);assert.equal(fixedApiResponse.body.success,false);
 assert.equal((await c.query('SELECT count(*) n FROM private.targeted_card_recovery')).rows[0].n,'1');
 assert.equal(notifications,0);assert.equal(adminEmails,0);
 await c.query("CREATE FUNCTION private.synthetic_event_write_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SYNTHETIC_EVENT_DB_FAILURE'; END $$;CREATE TRIGGER synthetic_event_failure BEFORE INSERT ON private.targeted_card_events FOR EACH ROW WHEN (NEW.event='approval_observed') EXECUTE FUNCTION private.synthetic_event_write_failure();");
 const oldDbFailure=await runOldCallbackRace(safeConfirm);assert.equal(oldDbFailure.status,409);assert.equal(oldDbFailure.body.success,false);
 assert.equal((await c.query('SELECT count(*) n FROM private.targeted_card_recovery')).rows[0].n,'0');assert.equal((await row(A)).status,'cancelled');assert.equal((await row(A)).refund_amount,0);
 await c.query('DROP TRIGGER synthetic_event_failure ON private.targeted_card_events;DROP FUNCTION private.synthetic_event_write_failure();');
 check('REPRODUCED_LEGACY_APPROVAL_THEN_DB_WRITE_FAILURE_ERROR_NO_EMAIL_NO_DURABLE_EVIDENCE');
 console.log('UNRESOLVED_RISK LEGACY_PG_APPROVAL_BEFORE_DB_FAILURE_HAS_NO_DURABLE_COMPENSATION; CLOSE_REQUIRES_ALL_OLD_REQUESTS_DRAINED');
 await mkdir(resolve(root,'.phase1-tests'),{recursive:true});
 await writeFile(resolve(root,'.phase1-tests/legacy-responses.json'),JSON.stringify({before:oldApiResponse,after:fixedApiResponse}));
 globalThis.__targetedAdmin=queryAdapter();
 check('ACTUAL_OLD_CALLBACK_INFLIGHT_APPROVAL_VS_CLOSE_200_BUG_TO_409_NO_EMAIL');
 const pageSource=await readFile(root+'/app/experiences/[id]/payment/page.tsx','utf8');
 assert.ok(pageSource.indexOf('if (!response.ok || !callbackResult.success)')<pageSource.indexOf('router.push(`/experiences/${experienceId}/payment/complete?orderId=${newOrderId}`)',pageSource.indexOf('if (!response.ok || !callbackResult.success)')));
 check('PAYMENT_PAGE_ERROR_BRANCH_PRECEDES_COMPLETE_NAVIGATION_SOURCE_CHECK');
 await reset();const originalC=await row(C);
 assert.equal(await remaining(),1);await assert.rejects(()=>c.query('SELECT * FROM create_booking_atomic($1,$2,$3,$4,2,false,$5,$6,$7,false)',[user,'4659','2026-10-15','12:00','Synthetic','000','card']),/BOOKING_CONFLICT/);
 check('BEFORE_CLOSE_PENDING2_CONFIRMED1_REMAINING1');
 const result=(await close()).rows[0].data;assert.equal(result.closed_count,2);
 for(const id of [A,B]){const b=await row(id);assert.equal(b.status,'cancelled');assert.equal(b.payment_claim_state,'released');assert.equal(b.tid,null);assert.equal(b.refund_amount,0);assert.equal(b.amount,46200);}
 assert.deepEqual(await row(C),originalC);assert.equal(await remaining(),3);
 assert.equal((await c.query('SELECT count(*) n FROM private.targeted_card_closeouts')).rows[0].n,'2');
 check('ATOMIC_PAIR_CLOSE_PRESERVES_C_AND_FINANCIAL_FIELDS');
 assert.equal((await close()).rows[0].data.already_closed,true);
 assert.equal((await c.query("SELECT count(*) n FROM private.targeted_card_events WHERE event='hold_closed'")).rows[0].n,'2');
 check('IDEMPOTENT_CLOSE_PRESERVES_ORIGINAL_SNAPSHOTS');

 globalThis.fetch=async()=>{calls++;throw Error('FORBIDDEN_APPROVAL');};
 for(const id of [A,B])await assert.rejects(()=>m.verifyApprovedCardPayment({provider:'nicepay',approvalId:'synthetic',orderId:id,expectedAmount:46200,providerPayload:{}}),/TARGETED_CARD_ATTEMPT_CLOSED/);
 assert.equal(calls,0);assert.equal(m.isTargetedNicePayCloseout(C),false);
 check('A_B_NEW_APPROVAL_BLOCKED_BEFORE_ANY_PG_REQUEST_C_NOT_FENCED');

 await c.query('SELECT * FROM confirm_experience_payment_atomic($1,$2,$1,$3,46200)',[A,'nicepay','SYNTHETIC-TID-A']);
 assert.equal((await row(A)).status,'cancelled');assert.equal(await remaining(),3);
 assert.equal((await c.query('SELECT state FROM private.targeted_card_recovery WHERE booking_id=$1',[A])).rows[0].state,'review_required');
 check('LEGACY_INFLIGHT_APPROVAL_CAPTURED_WITHOUT_REOPENING_SEAT');
 await assert.rejects(()=>c.query('SELECT * FROM confirm_experience_payment_atomic($1,$2,$1,$3,46200)',[B,'nicepay','SYNTHETIC-C-TID']),/TARGETED_CARD_TID_CONFLICT/);
 assert.deepEqual(await row(C),originalC);check('C_TID_CANNOT_BECOME_A_B_REFUND_TARGET');

 await reset();await c.query('SELECT * FROM confirm_experience_payment_atomic($1,$2,$1,$3,46200)',[B,'nicepay','SYNTHETIC-EARLY-B']);
 await assert.rejects(close,/TARGETED_CARD_SNAPSHOT_CONFLICT/);
 assert.equal((await row(A)).status,'PENDING');assert.equal((await row(B)).status,'PAID');
 assert.equal((await c.query('SELECT count(*) n FROM private.targeted_card_closeouts')).rows[0].n,'0');
 check('REAL_CONFIRM_WINS_CLOSE_ABORTS_PAIR_WITHOUT_PARTIAL_WRITE');

 await reset();await assert.rejects(()=>c.query('SELECT close_targeted_card_attempts_atomic($1,$2,$3)',['operator','wrong',evidence]),/PROTECTED_C_CONFLICT/);
 await c.query("SET ROLE authenticated");await assert.rejects(()=>c.query('SELECT close_targeted_card_attempts_atomic($1,$2,$3)',['operator','wrong',evidence]),/permission denied/);await c.query('RESET ROLE');
 check('C_SNAPSHOT_AND_AUTHENTICATED_EXECUTE_GUARDS');

 await c.query('UPDATE bookings SET refund_amount=NULL WHERE id=$1',[B]);
 await assert.rejects(close,/TARGETED_CARD_SNAPSHOT_CONFLICT/);
 assert.equal((await row(A)).status,'PENDING');assert.equal((await c.query('SELECT count(*) n FROM private.targeted_card_closeouts')).rows[0].n,'0');
 await reset();check('NULL_FINANCIAL_FIELD_BLOCKS_PAIR_CLOSE');

 await close();mockSuccess();
 const bad=payment();bad.raw.Moid=C;
 assert.equal((await m.recoverTargetedNicePayApproval({supabaseAdmin:adapter(),orderId:A,payment:bad})).outcome,'review_required');assert.equal(calls,0);
 check('MISMATCHED_APPROVAL_RECEIPT_NEVER_AUTHORIZES_REFUND');
 await m.recoverTargetedNicePayApproval({supabaseAdmin:adapter(),orderId:A,payment:payment()});
 assert.equal(calls,1);assert.equal((await row(A)).refund_amount,46200);assert.equal((await row(A)).tid,'SYNTHETIC-TID-A');assert.equal(await remaining(),3);
 const proof=(await c.query('SELECT approval_proof FROM private.targeted_card_recovery WHERE booking_id=$1',[A])).rows[0].approval_proof;
 assert.ok(!('BuyerEmail' in proof));assert.ok(!('AuthToken' in proof));
 check('SIGNED_COMPENSATION_PRESERVES_APPROVAL_REFUND_AUDIT_WITHOUT_AUTH_OR_PII');
 await m.recoverTargetedNicePayApproval({supabaseAdmin:adapter(),orderId:A,payment:payment()});assert.equal(calls,1);
 check('DUPLICATE_RECOVERY_DOES_NOT_SEND_SECOND_REFUND');

 for(let iteration=0;iteration<30;iteration++){
  await reset();await close();mockSuccess();
  await Promise.all(clients.map(x=>m.recoverTargetedNicePayApproval({supabaseAdmin:adapter(x),orderId:A,payment:payment()})));
  assert.equal(calls,1);assert.equal((await c.query('SELECT state FROM private.targeted_card_recovery')).rows[0].state,'refunded');
 }
 check('CONCURRENT_RECOVERY_DISPATCHES_EXACTLY_ONCE_30_ROUNDS_THREE_CONNECTIONS');

 await reset();await close();globalThis.fetch=async()=>{calls++;throw Error('SYNTHETIC_TIMEOUT');};
 await m.recoverTargetedNicePayApproval({supabaseAdmin:adapter(),orderId:A,payment:payment()});
 assert.equal((await c.query('SELECT state FROM private.targeted_card_recovery')).rows[0].state,'unknown');
 await m.recoverTargetedNicePayApproval({supabaseAdmin:adapter(),orderId:A,payment:payment()});
 assert.equal(calls,1);assert.equal((await row(A)).refund_amount,0);
 check('UNKNOWN_REFUND_RESULT_PRESERVED_AND_NOT_RETRIED');

 await reset();await close();mockSuccess();failNextName='finalize_targeted_card_refund_atomic';
 await assert.rejects(()=>m.recoverTargetedNicePayApproval({supabaseAdmin:adapter(),orderId:A,payment:payment()}),/DB_UNAVAILABLE/);
 assert.equal((await c.query('SELECT state FROM private.targeted_card_recovery')).rows[0].state,'accepted');
 await m.recoverTargetedNicePayApproval({supabaseAdmin:adapter(),orderId:A,payment:payment()});
 assert.equal(calls,1);assert.equal((await row(A)).refund_amount,46200);
 check('PG_ACCEPTED_DB_FINALIZE_FAILED_REPAIRS_DB_WITHOUT_PG_REPLAY');

 await reset();await close();mockSuccess();failNextName='record_targeted_card_refund_result_atomic';
 await assert.rejects(()=>m.recoverTargetedNicePayApproval({supabaseAdmin:adapter(),orderId:A,payment:payment()}),/DB_UNAVAILABLE/);
 assert.equal((await c.query('SELECT state FROM private.targeted_card_recovery')).rows[0].state,'dispatching');
 await m.recoverTargetedNicePayApproval({supabaseAdmin:adapter(),orderId:A,payment:payment()});assert.equal(calls,1);
 await m.reconcileTargetedNicePayRefund({supabaseAdmin:adapter(),orderId:A,payment:payment(),rawRefund:lastRefund});
 assert.equal(calls,1);assert.equal((await row(A)).refund_amount,46200);
 check('PG_SUCCESS_DB_EVIDENCE_WRITE_FAILED_SIGNED_RECONCILIATION_NO_REPLAY');

 await reset();await close();mockSuccess();
 await m.recordTargetedNicePayNotification({supabaseAdmin:adapter(),notification:{orderId:A,providerTransactionId:'SYNTHETIC-TID-A',amount:46200}});
 assert.equal(calls,0);assert.equal((await c.query('SELECT count(*) n FROM private.targeted_card_recovery')).rows[0].n,'0');assert.equal((await c.query('SELECT count(*) n FROM private.targeted_card_notifications')).rows[0].n,'1');
 assert.equal((await row(A)).refund_amount,0);
 check('LATE_NOTIFICATION_CAPTURE_ONLY_NEVER_CONFIRMS_OR_REFUNDS');

 await reset();mockSuccess();
 for(const id of [A,B]){
  const response=await routes.callbackPOST(new Request('http://127.0.0.1/api/payment/nicepay-callback',{
   method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({orderId:id,approvalId:'synthetic-old-auth'})}));
  assert.equal(response.status,400);assert.match((await response.json()).error,/TARGETED_CARD_ATTEMPT_CLOSED/);
 }
 assert.equal(calls,0);
 check('REAL_AUTHENTICATED_CALLBACK_DENIES_A_B_BEFORE_PG_AND_DB_CONFIRM');

 await reset();await close();mockSuccess();failNextName='record_targeted_card_approval_atomic';
 await assert.rejects(async()=>routes.finalizeExperienceCardPayment({supabaseAdmin:queryAdapter(),originalBooking:await row(A),verificationResult:payment()}),/DB_UNAVAILABLE/);
 assert.equal((await row(A)).status,'cancelled');assert.equal((await row(A)).refund_amount,0);assert.equal(calls,0);assert.equal(notifications,0);assert.equal(adminEmails,0);
 check('NEW_FINALIZER_EVIDENCE_WRITE_FAILURE_NEVER_ANNOUNCES_SUCCESS_OR_SENDS_EMAIL');
 await reset();
 await close();const routeC=await row(C);
 const finalized=await routes.finalizeExperienceCardPayment({supabaseAdmin:queryAdapter(),originalBooking:await row(A),verificationResult:payment()});
 assert.equal(finalized.success,false);assert.equal(finalized.status,409);assert.equal(calls,0);
 assert.equal((await c.query('SELECT state FROM private.targeted_card_recovery WHERE booking_id=$1',[A])).rows[0].state,'verified');
 assert.equal((await row(A)).status,'cancelled');assert.deepEqual(await row(C),routeC);
 check('REAL_FINALIZER_STORES_SIGNED_APPROVAL_WITHOUT_CONFIRM_EMAIL_OR_REFUND');

 const notificationResponse=await routes.handleNicePayCardNotification(new Request('http://127.0.0.1/api/payment/card-notification',{
  method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({Moid:B,TID:'SYNTHETIC-TID-B',Amt:'46200',PayMethod:'CARD',StateCd:'1'})}),{target:'experience'});
 assert.equal(notificationResponse.status,200);assert.equal(await notificationResponse.text(),'OK');assert.equal(calls,0);
 assert.equal((await row(B)).status,'cancelled');assert.deepEqual(await row(C),routeC);
 check('REAL_NOTIFICATION_ROUTE_ACKNOWLEDGES_UNVERIFIED_AUDIT_ONLY');

 const cResult=await routes.finalizeExperienceCardPayment({supabaseAdmin:queryAdapter(),originalBooking:await row(C),verificationResult:{provider:'nicepay',providerTransactionId:'SYNTHETIC-C-TID',approvedAmount:46200,raw:{}}});
 assert.equal(cResult.success,true);assert.equal(cResult.alreadyProcessed,true);assert.equal(notifications,0);assert.equal(adminEmails,0);
 assert.deepEqual(await row(C),routeC);assert.equal(calls,0);
 check('C_EXISTING_CONFIRMATION_PATH_AND_ENTIRE_ROW_UNCHANGED');

 await reset();const beforeReviewC=await row(C);
 const reviewSql=(await readFile(root+'/docs/audits/2026-10-09-targeted-card-closeout/CLOSEOUT_REVIEW.sql','utf8'))
  .replace("DO $$ BEGIN RAISE EXCEPTION 'REVIEW_ONLY_NO_PRODUCTION_EXECUTION_APPROVAL'; END $$;",'')
  .replaceAll('f0b5a7ec5234fd115183603c3fdf3354',await fingerprint())
  .replace('REPLACE_WITH_ACTUAL_USER_APPROVAL_REFERENCE','synthetic-local-review-only')
  .replace('REPLACE_WITH_VERIFIED_PRODUCTION_VERSION','synthetic-local-version');
 await c.query(reviewSql);assert.equal(await remaining(),1);assert.deepEqual(await row(C),beforeReviewC);
 assert.equal((await c.query('SELECT count(*) n FROM private.targeted_card_closeouts')).rows[0].n,'0');
 check('REVIEW_SQL_ASSERTIONS_EXECUTE_LOCALLY_AND_ROLL_BACK_ALL_BOOKING_CHANGES');

 await close();const preNewC=await row(C);
 await c.query('SELECT * FROM create_booking_atomic($1,$2,$3,$4,3,false,$5,$6,$7,false)',[user,'4659','2026-10-15','12:00','Synthetic','000','card']);
 assert.deepEqual(await row(C),preNewC);check('REAL_BOOKING_RPC_ACCEPTS_THREE_SEATS_AFTER_PAIR_CLOSE');
 // Fresh customers have taken all remaining seats; neither old confirmations
 // nor late compensation may reopen A/B or alter the new reservation or C.
 const filledRows=(await c.query('SELECT * FROM bookings ORDER BY id')).rows;
 mockSuccess();await m.recoverTargetedNicePayApproval({supabaseAdmin:adapter(),orderId:A,payment:payment()});
 assert.equal(await remaining(),0);assert.equal((await row(A)).status,'cancelled');
 for(const b of filledRows.filter(b=>![A,B].includes(b.id)))assert.deepEqual(await row(b.id),b);
 check('LATE_APPROVAL_AND_COMPENSATION_AFTER_NEW_THREE_SEAT_BOOKING_NEVER_OVERBOOK');

 for(const table of ['service_bookings','proxy_requests']){
  await reset();await close();await c.query('INSERT INTO '+table+'(tid) VALUES($1)',['SYNTHETIC-TID-A']);mockSuccess();
  await assert.rejects(()=>m.recoverTargetedNicePayApproval({supabaseAdmin:adapter(),orderId:A,payment:payment()}),/DB_UNAVAILABLE/);
  assert.equal(calls,0);assert.equal((await row(A)).refund_amount,0);
 }
 check('TID_ALREADY_USED_BY_SERVICE_OR_PROXY_NEVER_SENDS_REFUND');
 await reset();await close();mockSuccess();failNextName='record_targeted_card_approval_atomic';
 await assert.rejects(()=>m.recoverTargetedNicePayApproval({supabaseAdmin:adapter(),orderId:A,payment:payment()}),/DB_UNAVAILABLE/);assert.equal(calls,0);
 check('APPROVAL_EVIDENCE_DB_FAILURE_PREVENTS_REFUND_DISPATCH');
 await reset();await close();mockSuccess();failNextName='begin_targeted_card_refund_atomic';
 await assert.rejects(()=>m.recoverTargetedNicePayApproval({supabaseAdmin:adapter(),orderId:A,payment:payment()}),/DB_UNAVAILABLE/);assert.equal(calls,0);
 check('DISPATCH_CLAIM_DB_FAILURE_PREVENTS_PROVIDER_CALL');
 await reset();await close();mockSuccess();
 await Promise.all(Array.from({length:25},()=>m.recordTargetedNicePayNotification({supabaseAdmin:adapter(),notification:{orderId:A,providerTransactionId:'SYNTHETIC-TID-A',amount:46200}})));
 assert.equal((await c.query('SELECT count(*) n FROM private.targeted_card_recovery')).rows[0].n,'0');assert.equal((await c.query('SELECT receipt_count FROM private.targeted_card_notifications')).rows[0].receipt_count,'25');assert.equal(calls,0);
 check('DUPLICATE_NOTIFICATIONS_ONE_INBOX_RECORD_ZERO_FINANCIAL_OPERATIONS');
 await reset();await close();mockSuccess();
 const jsonFetch=globalThis.fetch;globalThis.fetch=async(...args)=>{const response=await jsonFetch(...args);const object=JSON.parse(await response.text());return new Response(new URLSearchParams(object).toString(),{status:200});};
 await m.recoverTargetedNicePayApproval({supabaseAdmin:adapter(),orderId:A,payment:payment()});
 assert.equal((await row(A)).refund_amount,46200);assert.equal(calls,1);
 check('SIGNED_FORM_ENCODED_REFUND_RECEIPT_PRESERVED_AND_FINALIZED');

 await reset();await close();mockSuccess();
 await m.recordTargetedNicePayNotification({supabaseAdmin:adapter(),notification:{orderId:A,providerTransactionId:'SYNTHETIC-CANCEL-TID',amount:46200,payload:{StateCd:'2'}}});
 assert.equal((await c.query('SELECT count(*) n FROM private.targeted_card_recovery')).rows[0].n,'0');
 await m.recoverTargetedNicePayApproval({supabaseAdmin:adapter(),orderId:A,payment:payment()});
 assert.equal(calls,1);assert.equal((await row(A)).refund_amount,46200);
 check('DIFFERENT_CANCEL_NOTIFICATION_TID_JOURNALED_NEVER_BECOMES_APPROVAL_AUTHORITY');

 await reset();await close();
 const crossTid=await Promise.allSettled([A,B].map((id,i)=>clients[i+1].query('SELECT record_targeted_card_approval_atomic($1,$2,46200,NULL)',[id,'SYNTHETIC-CROSS-TID'])));
 assert.equal(crossTid.filter(x=>x.status==='fulfilled').length,1);assert.equal(crossTid.filter(x=>x.status==='rejected').length,1);
 assert.equal((await c.query('SELECT count(*) n FROM private.targeted_card_recovery')).rows[0].n,'1');
 check('CONCURRENT_A_B_SAME_ORIGINAL_TID_ONE_OWNER_ONE_CONFLICT');
 await reset();await close();mockSuccess();
 await m.recordTargetedNicePayApproval({supabaseAdmin:adapter(),orderId:A,payment:payment()});
 await c.query('INSERT INTO service_bookings(tid) VALUES($1)',['SYNTHETIC-TID-A']);
 await assert.rejects(()=>m.recoverTargetedNicePayApproval({supabaseAdmin:adapter(),orderId:A,payment:payment()}),/DB_UNAVAILABLE/);assert.equal(calls,0);
 check('TID_REUSED_AFTER_EVIDENCE_RECORD_BLOCKS_DISPATCH');
 await reset();await close();mockSuccess();
 const originalTransport=globalThis.fetch;globalThis.fetch=async(...args)=>{const response=await originalTransport(...args);await c.query('INSERT INTO service_bookings(tid) VALUES($1)',['SYNTHETIC-TID-A']);return response;};
 await assert.rejects(()=>m.recoverTargetedNicePayApproval({supabaseAdmin:adapter(),orderId:A,payment:payment()}),/DB_UNAVAILABLE/);
 assert.equal(calls,1);assert.equal((await row(A)).refund_amount,0);assert.equal((await c.query('SELECT state FROM private.targeted_card_recovery')).rows[0].state,'accepted');
 check('TID_REUSE_AFTER_PG_CANCEL_PREVENTS_FALSE_DB_FINALIZATION_ACCEPTED_EVIDENCE_RETAINED');
 for(const field of ['Signature','TID','Moid','CancelAmt']){
  await reset();await close();mockSuccess();const successTransport=globalThis.fetch;
  globalThis.fetch=async(...args)=>{const response=await successTransport(...args);const raw=JSON.parse(await response.text());raw[field]='SYNTHETIC_WRONG';return new Response(JSON.stringify(raw),{status:200});};
  const result=await m.recoverTargetedNicePayApproval({supabaseAdmin:adapter(),orderId:A,payment:payment()});assert.equal(result.outcome,'review_required');
  assert.equal((await c.query('SELECT state FROM private.targeted_card_recovery')).rows[0].state,'unknown');assert.equal((await row(A)).refund_amount,0);
  await m.recoverTargetedNicePayApproval({supabaseAdmin:adapter(),orderId:A,payment:payment()});assert.equal(calls,1);
 }
 check('UNTRUSTED_REFUND_SIGNATURE_TID_MOID_AMOUNT_NEVER_MARK_SUCCESS_OR_RETRY');

 // Cancellation wins first: close must abort BOTH; cancelled A/B cannot be
 // converted to normal cancellation claims after close.
 await reset();const claimed=(await c.query('SELECT * FROM claim_booking_cancellation_atomic($1,$2)',[B,{status:'PENDING'}])).rows;
 assert.equal(claimed.length,1);await assert.rejects(close,/TARGETED_CARD_SNAPSHOT_CONFLICT/);
 assert.equal((await row(A)).status,'PENDING');assert.equal((await c.query('SELECT count(*) n FROM private.targeted_card_closeouts')).rows[0].n,'0');
 await reset();await close();assert.equal((await c.query('SELECT * FROM claim_booking_cancellation_atomic($1,$2)',[A,{status:'cancelled'}])).rowCount,0);
 await assert.rejects(()=>c.query('SELECT * FROM settle_experience_payouts_atomic($1,$2)',[[A,B],{[A]:0,[B]:0}]),/PAYOUT_SNAPSHOT_CONFLICT/);
 check('EXISTING_CANCELLATION_AND_PAYOUT_AUTHORITIES_CANNOT_MUTATE_CLOSED_UNPAID_PAIR');

 // Independent PostgreSQL transactions, real locks, rollback simulated external
 // actions so C must remain byte-for-byte equal. No sleep-based race ordering.
 const closingPid=(await clients[2].query('SELECT pg_backend_pid() pid')).rows[0].pid;
 const waitForCloseLock=async()=>{for(let i=0;i<100;i++){const activity=(await c.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[closingPid])).rows[0];if(activity?.wait_event_type==='Lock')return;await new Promise(r=>setTimeout(r,10));}throw Error('EXPECTED_REAL_CLOSE_LOCK_WAIT_NOT_OBSERVED');};
 for(let iteration=0;iteration<10;iteration++){
  await reset();const cp=await fingerprint(),cBefore=await row(C);
  await clients[1].query('BEGIN');await clients[1].query("SELECT * FROM claim_booking_cancellation_atomic($1,$2)",[B,{status:'PENDING'}]);
  const waitingClose=clients[2].query('SELECT close_targeted_card_attempts_atomic($1,$2,$3)',['operator',cp,evidence]);
  const observedClose=waitingClose.then(x=>({value:x}),error=>({error}));
  await waitForCloseLock();await clients[1].query('ROLLBACK');assert.equal((await observedClose).value.rows[0].close_targeted_card_attempts_atomic.closed_count,2);
  assert.deepEqual(await row(C),cBefore);
 }
 check('CONCURRENT_CANCELLATION_ROLLBACK_AND_PAIR_CLOSE_NO_DEADLOCK_TEN_ROUNDS');
 await reset();await clients[1].query('BEGIN');await clients[1].query('SELECT private.lock_booking_money(4659)');await clients[1].query('SELECT id FROM bookings WHERE id=$1 FOR UPDATE',[C]);
 const cBefore=await row(C),cp=await fingerprint();const waitingClose=clients[2].query('SELECT close_targeted_card_attempts_atomic($1,$2,$3)',['operator',cp,evidence]);
 await waitForCloseLock();await clients[1].query('ROLLBACK');await waitingClose;assert.deepEqual(await row(C),cBefore);
 check('SETTLEMENT_MONEY_THEN_C_ROW_LOCK_VS_CLOSE_NO_C_MUTATION_OR_DEADLOCK');
 await reset();const createRaceC=await row(C),createRaceFingerprint=await fingerprint();
 await clients[1].query('BEGIN');await clients[1].query("SELECT pg_advisory_xact_lock(hashtext('4659|2026-10-15|12:00')::bigint)");
 const createWaitingClose=clients[2].query('SELECT close_targeted_card_attempts_atomic($1,$2,$3)',['operator',createRaceFingerprint,evidence]);
 await waitForCloseLock();
 await clients[1].query('SELECT * FROM create_booking_atomic($1,$2,$3,$4,1,false,$5,$6,$7,false)',[user,'4659','2026-10-15','12:00','Synthetic','000','card']);
 await clients[1].query('COMMIT');await createWaitingClose;
 assert.equal(await remaining(),2);assert.deepEqual(await row(C),createRaceC);
 check('CREATE_SLOT_FIRST_VS_CLOSE_ROW_FIRST_SERIALIZES_WITHOUT_DEADLOCK_OR_OVERBOOK');
 await reset();const payoutRaceC=await row(C);await clients[2].query('BEGIN');
 await clients[2].query('SELECT close_targeted_card_attempts_atomic($1,$2,$3)',['operator',await fingerprint(),evidence]);
 const payoutAttempt=clients[1].query('SELECT * FROM settle_experience_payouts_atomic($1,$2)',[[C],{[C]:33600}]);
 const payoutObserved=payoutAttempt.then(value=>({value}),error=>({error}));
 const payoutPid=clients[1].processID;
 assert.ok(payoutPid);let payoutLocked=false;for(let i=0;i<100;i++){if((await c.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[payoutPid])).rows[0]?.wait_event_type==='Lock'){payoutLocked=true;break;}await new Promise(r=>setTimeout(r,10));}
 assert.ok(payoutLocked);await clients[2].query('COMMIT');assert.match((await payoutObserved).error.message,/PAYOUT_SNAPSHOT_CONFLICT/);assert.deepEqual(await row(C),payoutRaceC);
 check('ACTUAL_SETTLEMENT_RPC_VS_CLOSE_C_SHARE_LOCK_NO_C_MUTATION_OR_DEADLOCK');
 await reset();await c.query("UPDATE bookings SET payment_claim_expires_at=now()+interval '1 minute' WHERE id=$1",[B]);
 await assert.rejects(close,/TARGETED_CARD_SNAPSHOT_CONFLICT/);assert.equal((await row(A)).status,'PENDING');
 check('UNEXPECTED_ACTIVE_CLAIM_EXPIRY_BLOCKS_ATOMIC_PAIR_CLOSE');
 await reset();const drainFingerprint=await fingerprint();await assert.rejects(()=>c.query('SELECT close_targeted_card_attempts_atomic($1,$2,$3)',['operator',drainFingerprint,{...evidence,old_workers_drained:false}]),/TARGETED_CARD_EVIDENCE_REQUIRED/);
 assert.equal((await row(A)).status,'PENDING');assert.equal((await row(B)).status,'PENDING');
 check('MISSING_OLD_WORKER_DRAIN_ATTESTATION_BLOCKS_CLOSE');
 await reset();await close();const nonTargetC=await row(C);
 await c.query('SELECT * FROM create_booking_atomic($1,$2,$3,$4,1,false,$5,$6,$7,false)',[user,'4659','2026-10-15','12:00','Synthetic','000','card']);
 const normal=(await c.query('SELECT id FROM bookings WHERE id<>ALL($1::text[])',[[A,B,C]])).rows[0].id;
 await c.query("UPDATE bookings SET payment_provider='nicepay',payment_provider_reference=id,payment_claim_state='processing' WHERE id=$1",[normal]);
 const normalResponse=await routes.finalizeExperienceCardPayment({supabaseAdmin:queryAdapter(),originalBooking:await row(normal),verificationResult:{provider:'nicepay',providerTransactionId:'SYNTHETIC-NORMAL-TID',approvedAmount:46200,raw:{}}});
 assert.equal(normalResponse.success,true);assert.equal((await row(normal)).status,'PAID');assert.equal(notifications,1);assert.equal(adminEmails,1);assert.deepEqual(await row(C),nonTargetC);
 check('NON_TARGET_NORMAL_NICEPAY_CONFIRMATION_EMAIL_BOUNDARIES_AND_SETTLEMENT_UNCHANGED');
 await reset();await close();await m.recordTargetedNicePayApproval({supabaseAdmin:adapter(),orderId:A,payment:payment()});
 await c.query('SELECT record_targeted_card_approval_atomic($1,$2,46200,NULL)',[B,'SYNTHETIC-TID-B']);
 const snapshot=async()=>(await c.query('SELECT * FROM get_targeted_card_ops_snapshot() ORDER BY diagnostic_code')).rows;
 let ops=await snapshot();assert.equal(ops.length,2);assert.equal(ops[0].aggregate_details.verified,1);assert.equal(ops[1].aggregate_details.review_required,1);
 const initialVersion=ops[0].aggregate_details.incident_version;
 await m.recordTargetedNicePayApproval({supabaseAdmin:adapter(),orderId:A,payment:payment()});
 assert.equal((await snapshot())[0].aggregate_details.incident_version,initialVersion);
 const operation=(await c.query('SELECT id FROM private.targeted_card_recovery WHERE booking_id=$1',[A])).rows[0].id;
 const ack=(await c.query('SELECT acknowledge_targeted_card_recovery_atomic($1,$2,$3) result',[operation,'synthetic-operator','synthetic-case'])).rows[0].result;
 assert.equal(ack.resolved,false);assert.equal(ack.state,'verified');assert.equal((await snapshot())[0].aggregate_details.incident_version,initialVersion);
 assert.equal((await snapshot())[0].aggregate_details.unassigned,0);
 check('A_B_PER_ORDER_VISIBILITY_DUPLICATE_RECEIPT_STABLE_VERSION_ACK_NOT_RESOLUTION');
 await c.query('SELECT begin_targeted_card_refund_atomic($1)',[operation]);assert.equal((await snapshot())[0].aggregate_details.dispatching,1);
 await c.query("SELECT record_targeted_card_refund_result_atomic($1,'unknown','{}')",[operation]);assert.equal((await snapshot())[0].aggregate_details.unknown,1);
 mockSuccess();const request={providerTransactionId:payment().providerTransactionId,orderId:A,cancelAmount:46200,totalAmount:46200,requireMerchantKey:true,cancelReason:'synthetic'};
 const response=await m.cancelCardPayment(request);
 await c.query("SELECT record_targeted_card_refund_result_atomic($1,'accepted',$2)",[operation,JSON.parse(response.raw)]);
 assert.equal((await snapshot())[0].aggregate_details.accepted,1);
 const reviewBefore=(await c.query('SELECT get_targeted_card_recovery_review() review')).rows[0].review;
 assert.equal(reviewBefore.operations.find(x=>x.id===operation).resolved,false);
 await c.query('SELECT finalize_targeted_card_refund_atomic($1)',[operation]);
 ops=await snapshot();assert.equal(ops.length,1);assert.equal(ops[0].diagnostic_code,'targeted_card_recovery_b');
 const reviewAfter=(await c.query('SELECT get_targeted_card_recovery_review() review')).rows[0].review;
 assert.equal(reviewAfter.operations.find(x=>x.id===operation).resolved,true);assert.ok(reviewAfter.operations.find(x=>x.id===operation).approval_proof);assert.ok(reviewAfter.operations.find(x=>x.id===operation).refund_proof);
 check('ALL_FIVE_UNRESOLVED_STATES_ALERTABLE_ONLY_FINANCIALLY_APPLIED_REFUND_RESOLVES_AUDIT_RETAINED');
 await c.query('SELECT record_targeted_card_approval_atomic($1,$2,46200,NULL)',[B,'SYNTHETIC-NEW-INCIDENT']);
 assert.equal((await snapshot())[0].anomaly_count,'2');
 check('NEW_TID_CREATES_DISTINCT_FINANCIAL_INCIDENT_DUPLICATE_TID_DOES_NOT');
 for(const gate of ['alternate_worker_paths_blocked','financial_visibility_verified']){
  await reset();const cp=await fingerprint();await assert.rejects(()=>c.query('SELECT close_targeted_card_attempts_atomic($1,$2,$3)',['operator',cp,{...evidence,[gate]:false}]),/TARGETED_CARD_EVIDENCE_REQUIRED/);
  assert.equal((await row(A)).status,'PENDING');assert.equal((await row(B)).status,'PENDING');
 }
 check('ALTERNATE_WORKER_AND_FINANCIAL_VISIBILITY_ATTESTATIONS_REQUIRED_NO_PARTIAL_CLOSE');

 {
 // Local rehearsal of the exact future, nonfinancial production probe.
 const probeSql=await readFile(root+'/docs/audits/2026-10-09-targeted-card-closeout/POSTGREST_PROBE_REVIEW.sql','utf8');
 await c.query(probeSql.split('-- PROBE_SETUP_BEGIN')[1].split('-- PROBE_SETUP_END')[0]);
 const probeNonce=(await c.query('SELECT nonce FROM private.phase1_postgrest_commit_probe')).rows[0].nonce;
 for(let i=0;i<60;i++){const state=await localFetch('http://127.0.0.1:'+restPort+'/');const doc=await state.json();if(doc.paths?.['/rpc/phase1_postgrest_commit_probe_atomic'])break;await new Promise(r=>setTimeout(r,100));}
 const probeBeforeC=await row(C);
 const probeResult=await restClient.rpc('phase1_postgrest_commit_probe_atomic',{p_nonce:probeNonce}).maybeSingle();
 assert.equal(probeResult.status,409);assert.ok(probeResult.error);assert.equal(probeResult.data,null);
 const probeCommitted=(await c.query('SELECT observed_at,http_status FROM private.phase1_postgrest_commit_probe')).rows[0];
 assert.ok(probeCommitted.observed_at);assert.equal(probeCommitted.http_status,409);
 const deniedProbe=await restRequest('phase1_postgrest_commit_probe_atomic',{p_nonce:probeNonce},null);assert.ok([401,403,404].includes(deniedProbe.status));
 await restClient.rpc('phase1_postgrest_commit_probe_atomic',{p_nonce:probeNonce}).maybeSingle();
 assert.equal((await c.query('SELECT count(*) n FROM private.phase1_postgrest_commit_probe')).rows[0].n,'1');assert.deepEqual(await row(C),probeBeforeC);
 check('NONFINANCIAL_OPERATING_PROBE_REHEARSAL_409_COMMIT_ANON_DENIED_IDEMPOTENT_ONE_ROW');
 await c.query("UPDATE private.phase1_postgrest_commit_probe SET expires_at=now()-interval '1 second'");
 const expiredProbe=await restClient.rpc('phase1_postgrest_commit_probe_atomic',{p_nonce:probeNonce});assert.ok(expiredProbe.error);
 await c.query('DROP FUNCTION public.phase1_postgrest_commit_probe_atomic(uuid);DROP TABLE private.phase1_postgrest_commit_probe;');
 check('NONFINANCIAL_PROBE_15_MINUTE_EXPIRY_AND_EXACT_OBJECT_CLEANUP_NO_BOOKING_WRITES');
 await reset();globalThis.__targetedAdmin=queryAdapter();failNextName='record_targeted_card_notification_atomic';
 const unavailableNotice=await postNotification({Moid:A,TID:'SYNTHETIC-WRITE-FAILED',Amt:'46200'});
 assert.equal(unavailableNotice.status,503);assert.equal(unavailableNotice.headers.get('Retry-After'),'60');
 assert.notEqual(await unavailableNotice.text(),'OK');assert.equal((await c.query('SELECT count(*) n FROM private.targeted_card_notifications')).rows[0].n,'0');
 check('NOTIFICATION_DB_WRITE_FAILURE_NEVER_ACKS_AND_RETURNS_RETRYABLE_503');
 // Bounded inbox: actual public route -> service JWT -> actual PostgREST.
 await reset();globalThis.__targetedAdmin={...queryAdapter(),rpc:restClient.rpc.bind(restClient)};
 const budgetC=await row(C);
 const nPayload=i=>({Moid:A,TID:'SYNTHETIC-NOTICE-'+i,Amt:'46200',MID:'audit0000m',PayMethod:'CARD',StateCd:'0'});
 // Fill all but one, then race across independent SQL connections at the cap.
 for(let i=0;i<511;i++)await c.query('SELECT record_targeted_card_notification_atomic($1,$2,46200,$3)',[A,nPayload(i).TID,nPayload(i)]);
 const raced=await Promise.all(clients.map((conn,i)=>conn.query('SELECT record_targeted_card_notification_atomic($1,$2,46200,$3) result',[A,nPayload(511+i).TID,nPayload(511+i)])));
 assert.equal(raced.filter(x=>x.rows[0].result.stored).length,1);
 assert.equal((await c.query('SELECT count(*) n FROM private.targeted_card_notifications')).rows[0].n,'512');
 check('NOTIFICATION_CAP_ATOMIC_ACROSS_THREE_CONNECTIONS_512_ROWS_MAX');
 const rejected=await postNotification(nPayload(999));assert.equal(rejected.status,503);assert.equal(rejected.headers.get('Retry-After'),'60');assert.notEqual(await rejected.text(),'OK');
 const summaryBefore=(await c.query('SELECT * FROM private.targeted_card_notification_budgets')).rows[0];
 for(let i=0;i<20;i++){const over=await postNotification(nPayload(1000+i));assert.equal(over.status,503);}
 const summaryAfter=(await c.query('SELECT * FROM private.targeted_card_notification_budgets')).rows[0];
 assert.deepEqual(summaryAfter,summaryBefore);assert.equal(summaryAfter.overflow_windows,'1');
 assert.equal((await c.query('SELECT count(*) n FROM private.targeted_card_notifications')).rows[0].n,'512');
 check('CAP_OVERFLOW_NEVER_ACKS_UNSTORED_ENVELOPE_BOUNDED_SUMMARY_WRITE_ONCE_PER_MINUTE');
 const replay=await postNotification(nPayload(0));assert.equal(replay.status,200);assert.equal(await replay.text(),'OK');
 for(let i=0;i<80;i++)assert.equal((await postNotification(nPayload(0))).status,200);
 assert.equal((await c.query("SELECT receipt_count FROM private.targeted_card_notifications WHERE payload->>'TID'=$1",[nPayload(0).TID])).rows[0].receipt_count,'32');
 check('ALREADY_STORED_PROVIDER_RETRIES_ACK_AT_CAPACITY_REPLAY_FLOOD_WRITES_BOUNDED');
 const inboxSnapshot=(await restClient.rpc('get_targeted_card_ops_snapshot')).data;
 assert.equal(inboxSnapshot.length,1);assert.equal(inboxSnapshot[0].diagnostic_code,'targeted_card_notification_a');assert.equal(inboxSnapshot[0].aggregate_details.capacity_exhausted,1);
 assert.equal((await c.query('SELECT count(*) n FROM private.targeted_card_recovery')).rows[0].n,'0');
 await close();assert.equal(await remaining(),3);assert.deepEqual(await row(C),budgetC);
 check('UNVERIFIED_CAPACITY_WARNING_NOT_FINANCIAL_INCIDENT_OR_CLOSEOUT_BLOCK_C_UNCHANGED');
 await reset();globalThis.__targetedAdmin={...queryAdapter(),rpc:restClient.rpc.bind(restClient)};
 await postNotification(nPayload(0));
 const opsInbox=async()=>(await restClient.rpc('get_targeted_card_ops_snapshot')).data;
 const seen=(await opsInbox())[0].aggregate_details.notice_version;
 await restClient.rpc('review_targeted_card_notifications_atomic',{p_booking_id:A,p_through_version:seen,p_owner_reference:'synthetic-owner',p_case_reference:'synthetic-review'});
 assert.equal((await opsInbox()).length,0);assert.equal((await c.query('SELECT count(*) n FROM private.targeted_card_notifications')).rows[0].n,'1');
 await postNotification(nPayload(0));assert.equal((await opsInbox()).length,0);
 await postNotification(nPayload(1));assert.equal((await opsInbox())[0].aggregate_details.unreviewed,1);
 // A stale reviewed watermark cannot swallow a notice received after review.
 await restClient.rpc('review_targeted_card_notifications_atomic',{p_booking_id:A,p_through_version:seen,p_owner_reference:'synthetic-owner',p_case_reference:'synthetic-review'});
 assert.equal((await opsInbox())[0].aggregate_details.unreviewed,1);
 assert.equal((await c.query('SELECT count(*) n FROM private.targeted_card_recovery')).rows[0].n,'0');
 check('EXPLICIT_INBOX_REVIEW_WATERMARK_PRESERVES_EVIDENCE_NEW_NOTICE_ALERTS_AGAIN_NO_FINANCIAL_AUTHORITY');
 globalThis.__targetedAdmin=queryAdapter();
 }
 console.log('TARGETED_CARD_CLOSEOUT_PASS '+JSON.stringify({checks,postgres:(await c.query("SELECT current_setting('server_version') v")).rows[0].v,productionWrites:0,realProviderCalls:0}));
}finally{if(restServer && restServer.exitCode===null && restServer.signalCode===null){const exited=new Promise(r=>restServer.once('exit',r));restServer.kill('SIGTERM');await exited;}for(const c of clients)await c.end().catch(()=>{});await db.stop().catch(()=>{});await rm(temp,{recursive:true,force:true});}
