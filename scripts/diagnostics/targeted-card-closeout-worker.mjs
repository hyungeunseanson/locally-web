// Actual modified payment helpers in workerd, with synthetic signed receipts.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(root+'/package.json');const {build}=require('esbuild');const {Miniflare,convertV4MiniflareOptions}=require('miniflare');
const temp=await mkdtemp('/tmp/locally-phase1-workerd-');
const entry=String.raw`
import crypto from 'node:crypto';
import {verifyApprovedCardPayment} from './app/utils/payments/card/server';
import {recordTargetedNicePayApproval,recoverTargetedNicePayApproval} from './app/utils/payments/card/targetedNicePayCloseout';
import {isTargetedNicePayCloseout} from './app/utils/payments/card/targetedCloseoutTargets';
export default {async fetch(){
 const A='ORD-20261008232253248-691',C='ORD-20261009014356883-813',tid='SYNTHETIC-WORKER-TID',mid='audit0000m',key='SYNTHETIC_KEY',amt='000000046200';
 process.env.NICEPAY_MID=mid;process.env.NICEPAY_MERCHANT_KEY=key;
 let fenced=false;try{await verifyApprovedCardPayment({provider:'nicepay',approvalId:tid,orderId:A,expectedAmount:46200,providerPayload:{}});}catch(e){fenced=String(e).includes('TARGETED_CARD_ATTEMPT_CLOSED');}
 const payment={provider:'nicepay',providerTransactionId:tid,approvedAmount:46200,raw:{ResultCode:'3001',Moid:A,TID:tid,MID:mid,Amt:amt,PayMethod:'CARD',Signature:crypto.createHash('sha256').update(tid+mid+amt+key).digest('hex')}};
 let proof=null,state='verified',dispatches=0;
 const db={rpc:async(name,args)=>{if(name==='record_targeted_card_approval_atomic'){proof=args.p_proof;return {data:{id:'synthetic-operation',state},error:null};}if(name==='begin_targeted_card_refund_atomic'){state='dispatching';return {data:true,error:null};}if(name==='record_targeted_card_refund_result_atomic'){state=args.p_outcome;return {data:{id:'synthetic-operation',state},error:null};}if(name==='finalize_targeted_card_refund_atomic'){state='refunded';return {data:{id:'synthetic-operation',state},error:null};}throw Error('UNEXPECTED_RPC');}};
 await recordTargetedNicePayApproval({supabaseAdmin:db,orderId:A,payment});const signatureVerified=proof!==null;
 const result=await recoverTargetedNicePayApproval({supabaseAdmin:db,orderId:A,payment,cancel:async()=>{dispatches++;const cancelAmt='46200';return {raw:JSON.stringify({ResultCode:'2001',MID:mid,TID:tid,Moid:A,CancelAmt:cancelAmt,CancelNum:'SYNTHETIC-CANCEL',Signature:crypto.createHash('sha256').update(tid+mid+cancelAmt+key).digest('hex')})};}});
 return Response.json({fenced,cProtected:!isTargetedNicePayCloseout(C),signatureVerified,dispatches,outcome:result.outcome});
}};
`;
await build({stdin:{contents:entry,resolveDir:root,loader:'ts'},outfile:temp+'/worker.mjs',bundle:true,platform:'neutral',format:'esm',alias:{crypto:'node:crypto'},external:['node:crypto'],tsconfig:root+'/tsconfig.json',plugins:[{name:'portone-out-of-scope',setup(b){b.onResolve({filter:/portone\/server/},()=>({path:'portone',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:"export const getPortOnePayment=()=>{throw Error('PORTONE_FORBIDDEN')};export const isPortOneCardReady=()=>false;",loader:'js'}));}}]});
let worker;
try{
 worker=new Miniflare({...convertV4MiniflareOptions({modules:true,script:await readFile(temp+'/worker.mjs','utf8'),compatibilityDate:'2026-09-08',compatibilityFlags:['nodejs_compat','global_fetch_strictly_public'],host:'127.0.0.1',port:0,outboundService:()=>{throw Error('UNMOCKED_WORKER_PROVIDER_CALL_FORBIDDEN');}}),telemetry:{enabled:false}});
 const response=await worker.dispatchFetch('http://127.0.0.1/');assert.equal(response.status,200);const result=await response.json();
 assert.deepEqual(result,{fenced:true,cProtected:true,signatureVerified:true,dispatches:1,outcome:'refunded'});
 console.log('WORKER_RUNTIME_COMPATIBILITY_PASS '+JSON.stringify({...result,actualProviderCalls:0,productionWrites:0}));
}finally{if(worker)await worker.dispose();await rm(temp,{recursive:true,force:true});}
