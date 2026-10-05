// Loopback-only Chromium regression using the actual guest page, receipt, notification
// provider, host earnings summary and chart. Auth/Supabase/API are synthetic; no money calls.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here=fileURLToPath(new URL('.',import.meta.url)),root=resolve(here,'../..');
const require=createRequire(join(root,'package.json'));
const {build}=require('esbuild');
const {chromium}=require('@playwright/test');
const temporary=await mkdtemp(join(tmpdir(),'solo-ui-regression-'));
const entry=String.raw`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import QueryProvider from './app/providers/QueryProvider';
import {useQueryClient} from '@tanstack/react-query';
import {NotificationProvider,useNotification} from './app/context/NotificationContext';
import {useGuestTrips} from './app/guest/trips/hooks/useGuestTrips';
import TripCard from './app/guest/trips/components/TripCard';
import PastTripCard from './app/guest/trips/components/PastTripCard';
import ReceiptModal from './app/guest/trips/components/ReceiptModal';
import GuestTripsPage from './app/guest/trips/page';
import Earnings from './app/host/dashboard/Earnings';
import {experienceUiDictionary} from './app/context/experienceUiDictionary';
const today=new Date().toISOString().slice(0,10);
const initialTrip={id:101,orderId:'SYNTHETIC',expId:1,hostId:'host',title:'Synthetic audit',date:today,time:'00:00',duration:3,status:'confirmed',guests:1,price:79800,amount:79800,refundAmount:0,created_at:new Date().toISOString(),soloGuaranteeRefundStatus:'not_applicable',soloGuaranteeRefundAmount:0,hasReview:true};
window.audit={lang:'ko',trips:[initialTrip],payout:60800,counters:{trips:0,summary:0,reservation:0,chart:0,notifications:0},channels:[],pushes:[],toasts:[],notificationRows:[],dictionary:experienceUiDictionary};
const a=window.audit;
const row=()=>({id:'audit-A',order_id:'SYNTHETIC',user_id:'guest',experience_id:1,date:today,time:'00:00',guests:1,status:'completed',created_at:new Date().toISOString(),amount:79800,total_price:a.payout===60800?76000:38000,total_experience_price:a.payout===60800?76000:38000,host_payout_amount:a.payout,platform_revenue:a.payout===60800?19000:11400,payout_status:'pending',solo_guarantee_refund_status:a.payout===60800?'not_applicable':'refunded',solo_guarantee_refund_amount:a.payout===60800?0:38000,experiences:{title:'Synthetic audit',duration:3}});
const client={auth:{getUser:async()=>({data:{user:{id:'guest'}}})},from(table){let columns='';const q={select(c){columns=c;return q},eq(){return q},in(){return q},order(){return q},limit(){return q},then(resolve){let data=[];if(table==='notifications'){a.counters.notifications++;data=a.notificationRows}
if(table==='experiences')data=[{id:1}];if(table==='public_profiles')data=[{id:'guest',full_name:'Synthetic'}];if(table==='guest_reviews')data=[{booking_id:'audit-A'}];
if(table==='bookings'){a.counters[columns.includes('contact_name')?'reservation':'chart']++;data=[row()]}
return Promise.resolve({data:structuredClone(data),error:null}).then(resolve)}};return q},
channel(name){const c={name,on(event,filter,fn){a.channels.push({name,filter,fn});return c},subscribe(){return c}};return c},removeChannel(){return Promise.resolve()}};
a.client=client;
a.emit=(table,eventType,newRow)=>a.channels.filter(c=>c.filter.table===table).forEach(c=>c.fn({eventType,new:newRow,old:newRow}));
window.fetch=async(url)=>{if(String(url).includes('/api/host/earnings/summary')){a.counters.summary++;const e={pending_payout_amount:a.payout,in_progress_amount:0,paid_payout_amount:0,payout_item_count:1,completed_booking_count:1,latest_paid_at:null,total_payout_amount:a.payout};return new Response(JSON.stringify({success:true,summary:{total_pending_payout_amount:a.payout,total_in_progress_amount:0,total_paid_amount:0,latest_paid_at:null,experience:e,service:{...e,pending_payout_amount:0,total_payout_amount:0,completed_service_count:0}}}))}
if(String(url).includes('/api/services/requests'))return new Response(JSON.stringify({success:true,data:[]}));
if(String(url).includes('guest-memberships'))return new Response(JSON.stringify({success:true,memberships:{}}));
if(String(url).includes('sync-completed'))return new Response(JSON.stringify({success:true,updatedCount:0,updatedIds:[]}));
throw new Error('Forbidden non-fixture request '+url)};
function App(){const [version,setVersion]=useState(0);a.setLang=lang=>{a.lang=lang;setVersion(v=>v+1)};
return <div key={version}><QueryProvider><NotificationProvider><section id="guest"><GuestTripsPage/></section></NotificationProvider></QueryProvider>
<section id="earnings"><Earnings/></section>{a.localeReceipt&&<section id="locale-receipt"><ReceiptModal trip={a.trips[0]} onClose={()=>{}}/></section>}</div>}
createRoot(document.getElementById('root')).render(<App/>);
`;
const modules={
'@/app/utils/supabase/client':"export const createClient=()=>window.audit.client;",
'@/app/context/AuthContext':"const refreshHostStatus=()=>{};export const useAuth=()=>({user:{id:'guest'},refreshHostStatus});",
'@/app/context/ToastContext':"const showToast=(...v)=>window.audit.toasts.push(v);export const useToast=()=>({showToast});",
'@/app/context/LanguageContext':"const t=k=>k;export const useLanguage=()=>({lang:window.audit.lang,t});",
'@/app/utils/api/trips':"export const fetchGuestTrips=async()=>{window.audit.counters.trips++;return {trips:structuredClone(window.audit.trips),syncCompletedNeeded:false}};export const cancelGuestTrip=async()=>{throw Error('Forbidden cancellation')};export const syncCompletedGuestTrips=async()=>({updatedCount:0,updatedIds:[]});",
'next/navigation':"const router={push:u=>window.audit.pushes.push(u),replace:u=>window.audit.pushes.push(u),refresh:()=>{}};const params=new URLSearchParams('reservationTab=completed');export const useRouter=()=>router;export const useSearchParams=()=>params;",
'next/link':"import React from 'react';export default ({href,children,...p})=><a href={href} {...p}>{children}</a>;",
'next/image':"import React from 'react';export default ({fill,unoptimized,priority,...p})=><img {...p}/>;",
'html-to-image':"export const toPng=async()=>{throw Error('No image export in audit')};"
};
await build({stdin:{contents:entry,resolveDir:root,loader:'tsx'},bundle:true,platform:'browser',format:'iife',define:{'process.env':'{}'},outfile:join(temporary,'bundle.js'),tsconfig:join(root,'tsconfig.json'),plugins:[{name:'audit-fixture-boundaries',setup(b){
b.onResolve({filter:/.*/},args=>{if(modules[args.path])return {path:args.path,namespace:'mock'};if(/(GuestProfileModal|GuestReviewModal|CancellationModal|ServiceEarningsPanel|SiteHeader|ReviewModal)$/.test(args.path))return {path:args.path,namespace:'empty'};return null});
b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:modules[args.path],loader:'jsx',resolveDir:root}));
b.onLoad({filter:/.*/,namespace:'empty'},()=>({contents:'export default ()=>null;',loader:'js'}));
}}]});
const html='<!doctype html><html><head><style>#receipt{position:relative}.fixed{position:relative}section{border:1px solid #ddd;padding:8px}svg{width:16px;height:16px}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>';
const server=createServer(async(req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'application/javascript':'text/html');res.end(req.url==='/bundle.js'?await readFile(join(temporary,'bundle.js')):html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
let browser;const checks=[],errors=[];
try{
browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1600,height:1200}});
page.on('pageerror',e=>{errors.push(e.message);console.log('UI_ERROR '+e.message)});
page.on('console',m=>{if(m.type()==='error')console.log('UI_CONSOLE '+m.text())});
await page.goto('http://127.0.0.1:'+port+'/guest/trips');
await page.waitForFunction(()=>window.audit.counters.trips>=1&&window.audit.counters.summary>=1&&window.audit.counters.chart>=1&&window.audit.channels.some(x=>x.name==='host-earnings-booking-money'));
await page.getByRole('button',{name:'receipt',exact:true}).first().click();
const before=await page.evaluate(()=>({...window.audit.counters}));
assert.equal(await page.getByTestId('receipt-refund-net').count(),0);
await page.evaluate(()=>{const a=window.audit;a.trips[0].status='completed';a.trips[0].soloGuaranteeRefundStatus='refunded';a.trips[0].soloGuaranteeRefundAmount=38000;a.trips[0].refundAmount=38000;a.payout=30400;
const n={id:777,user_id:'guest',type:'refund',title:'1인 진행 추가금 환불 완료',message:'38,000원 환불 완료',link:'/guest/trips',is_read:false,created_at:new Date().toISOString()};a.notificationRows=[n];a.emit('notifications','INSERT',n);a.emit('bookings','UPDATE',{experience_id:1,status:'completed'})});
await page.waitForFunction(()=>window.audit.counters.trips>=2&&window.audit.counters.summary>=2&&window.audit.counters.chart>=2);
const net=await page.getByTestId('receipt-refund-net').innerText();assert.ok(net.includes('38,000')&&net.includes('41,800'));
assert.ok((await page.getByTestId('guest-past-trip-solo-refund-status-101').first().innerText()).includes('환불 완료'));
await page.getByTestId('host-earnings-details-toggle').click();
assert.ok((await page.getByTestId('host-earnings-summary-net-payout').innerText()).includes('30,400'));
const after=await page.evaluate(()=>({...window.audit.counters}));
checks.push({name:'refund_signal_refreshes_real_guest_page_open_receipt_host_summary_chart',before,after,net:41800});
for(const [lang,label,refunded,netLabel] of [['ko','환불 완료','환불 완료','순 결제'],['en','refunded','Refunded','Net payment'],['ja','返金完了','返金済み','返金後のお支払い'],['zh','已退款','已退款','净付款']]){
await page.evaluate(lang=>{window.audit.localeReceipt=true;window.audit.setLang(lang)},lang);
await page.waitForFunction(label=>document.querySelector('[data-testid="guest-past-trip-solo-refund-status-101"]')?.innerText.includes(label),label);
const receipt=await page.locator('#locale-receipt').innerText();assert.ok(receipt.includes(refunded)&&receipt.includes(netLabel));assert.ok(receipt.includes('79,800')&&receipt.includes('38,000')&&receipt.includes('41,800'));
checks.push({name:'localized_refund_and_receipt_'+lang,original:79800,refund:38000,net:41800});}
assert.equal(errors.length,0,'Browser page errors: '+errors.join('|'));
console.log('BROWSER_P0_PASS '+JSON.stringify({checks,pageErrors:errors}));
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));await rm(temporary,{recursive:true,force:true})}
