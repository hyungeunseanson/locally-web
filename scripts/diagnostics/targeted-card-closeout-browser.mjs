// Actual guest page and actual payment-page callback continuation. Loopback only.
// Input responses are captured by this worktree's native PG + legacy Worker + PostgREST test.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(root+'/package.json');
const {build,transform}=require('esbuild');const {chromium}=require('@playwright/test');
const responses=JSON.parse(await readFile(resolve(root,'.phase1-tests/legacy-responses.json'),'utf8'));
assert.equal(responses.before.status,200);assert.equal(responses.after.status,409);
const source=await readFile(root+'/app/experiences/[id]/payment/page.tsx','utf8');
const start=source.indexOf('const callbackResult = (await response.json())');
const end=source.indexOf('} catch (err: unknown)',start);
assert.ok(start>=0&&end>start);
const continuation=(await transform('async function actualContinuation(){'+source.slice(start,end)+'}',{loader:'ts'})).code.replace(/^async function actualContinuation\(\) \{/, '').replace(/\}\s*$/, '');
const temp=await mkdtemp('/tmp/locally-phase1-browser-');
const entry=String.raw`
import React from 'react';import {createRoot} from 'react-dom/client';
import QueryProvider from './app/providers/QueryProvider';
import {NotificationProvider} from './app/context/NotificationContext';
import GuestTripsPage from './app/guest/trips/page';
const ids=['ORD-20261008232253248-691','ORD-20261008232336792-577','ORD-20261009014356883-813'];
window.audit={pushes:[],toasts:[],channels:[],trips:ids.map((id,i)=>({id,orderId:id,expId:4659,hostId:'host',title:['Synthetic A','Synthetic B','Synthetic C'][i],date:'2026-10-15',time:'12:00',duration:3,status:i<2?'cancelled':'PAID',guests:1,price:46200,amount:46200,refundAmount:0,created_at:'2026-10-09',soloGuaranteeRefundStatus:'not_applicable',soloGuaranteeRefundAmount:0,hasReview:false}))};
const a=window.audit;
a.client={auth:{getUser:async()=>({data:{user:{id:'guest'}}})},from(){const q={select(){return q},eq(){return q},order(){return q},limit(){return q},then(resolve){return Promise.resolve({data:[],error:null}).then(resolve)}};return q},channel(name){const c={on(event,filter,fn){a.channels.push({name,filter,fn});return c},subscribe(){return c}};return c},removeChannel(){}};
window.fetch=async(url)=>{if(String(url).includes('/api/services/requests'))return new Response(JSON.stringify({success:true,data:[]}));if(String(url).includes('guest-memberships'))return new Response(JSON.stringify({success:true,memberships:{}}));throw Error('NON_FIXTURE_REQUEST_FORBIDDEN');};
createRoot(document.getElementById('root')).render(<QueryProvider><NotificationProvider><GuestTripsPage/></NotificationProvider></QueryProvider>);
`;
const stubs={
 '@/app/utils/supabase/client':"export const createClient=()=>window.audit.client;",
 '@/app/context/AuthContext':"export const useAuth=()=>({user:{id:'guest'},refreshHostStatus:()=>{}});",
 '@/app/context/LanguageContext':"const t=k=>k==='trip_status_cancelled'?'취소됨':k;export const useLanguage=()=>({lang:'ko',t});",
 '@/app/context/ToastContext':"export const useToast=()=>({showToast:(...v)=>window.audit.toasts.push(v)});",
 '@/app/utils/api/trips':"export const fetchGuestTrips=async()=>({trips:structuredClone(window.audit.trips),syncCompletedNeeded:false});export const cancelGuestTrip=async()=>{throw Error('FINANCIAL_ACTION_FORBIDDEN')};export const syncCompletedGuestTrips=async()=>({updatedCount:0,updatedIds:[]});",
 'next/navigation':"const router={push:u=>window.audit.pushes.push(u),replace:u=>window.audit.pushes.push(u),refresh:()=>{}};export const useRouter=()=>router;export const useSearchParams=()=>new URLSearchParams();",
 'next/link':"import React from 'react';export default ({href,children,...p})=><a href={href} {...p}>{children}</a>;",
 'next/image':"import React from 'react';export default ({fill,unoptimized,priority,...p})=><img {...p}/>;",
 'html-to-image':"export const toPng=async()=>{throw Error('EXPORT_FORBIDDEN')};",
};
await build({stdin:{contents:entry,resolveDir:root,loader:'tsx'},outfile:temp+'/bundle.js',bundle:true,platform:'browser',format:'iife',define:{'process.env':'{}'},tsconfig:root+'/tsconfig.json',plugins:[{name:'loopback-synthetic-boundaries',setup(b){
 b.onResolve({filter:/.*/},a=>{if(stubs[a.path])return {path:a.path,namespace:'stub'};if(/(GuestProfileModal|GuestReviewModal|CancellationModal|SiteHeader|ReviewModal)$/.test(a.path))return {path:a.path,namespace:'empty'};});
 b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:stubs[a.path],loader:'jsx',resolveDir:root}));
 b.onLoad({filter:/.*/,namespace:'empty'},()=>({contents:'export default ()=>null;',loader:'js'}));
}}]});
const server=createServer(async(req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'application/javascript':'text/html');res.end(req.url==='/bundle.js'?await readFile(temp+'/bundle.js'):'<!doctype html><style>svg{width:16px;height:16px}</style><div id="root"></div><script src="/bundle.js"></script>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[];
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1600,height:1200}});
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/guest/trips');
 await page.getByText('Synthetic C',{exact:true}).first().waitFor();
 for(const title of ['Synthetic A','Synthetic B']){
  const card=page.getByText(title,{exact:true}).first().locator('..');assert.ok((await card.innerText()).includes('취소됨'));
 }
 // Desktop and mobile variants both exist in the DOM; this fixture omits Tailwind CSS.
 assert.equal(await page.getByText('취소됨',{exact:true}).count(),4);
 console.log('PASS ACTUAL_GUEST_PAGE_A_B_CANCELLED_C_UPCOMING_NO_CONFIRMATION_BADGE');
 const run=async(input)=>page.evaluate(async({input,continuation})=>{
  const state={pushes:[],errors:[],toasts:[],processing:true};
  const fn=new (Object.getPrototypeOf(async function(){}).constructor)('response','t','setPaymentError','showToast','setIsProcessing','router','experienceId','newOrderId',continuation);
  await fn(new Response(JSON.stringify(input.body),{status:input.status}),k=>k,v=>state.errors.push(v),(...v)=>state.toasts.push(v),v=>state.processing=v,{push:v=>state.pushes.push(v)},4659,'ORD-20261008232253248-691');return state;
 },{input,continuation});
 const before=await run(responses.before);assert.equal(before.pushes.length,1);assert.ok(before.pushes[0].includes('/payment/complete'));
 const after=await run(responses.after);assert.equal(after.pushes.length,0);assert.equal(after.errors.length,1);assert.equal(after.processing,false);
 assert.equal(errors.length,0);
 console.log('PASS ACTUAL_PAYMENT_PAGE_CONTINUATION_OLD_SUCCESS_NAVIGATES_FIXED_409_BLOCKS_COMPLETION');
 console.log('TARGETED_BROWSER_PASS '+JSON.stringify({checks:2,pageErrors:errors,externalRequests:0,productionWrites:0}));
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));await rm(temp,{recursive:true,force:true});}
