import { expect, test, type Page } from '@playwright/test';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { resolve } from 'node:path';
let script: string, css: string;
test.beforeAll(async()=>{
  const bundle=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{useSearchParams}from'next/navigation';
    import Provider from './app/admin/dashboard/components/AdminAttentionProvider';import Sidebar from './app/admin/dashboard/components/Sidebar';
    import Tabs from './app/admin/dashboard/components/CustomerSupportTabs';import Alerts from './app/admin/dashboard/components/AdminAlertsTab';
    function Shell(){const p=useSearchParams();return <Provider userId="admin"><div className="flex min-h-screen"><div className="hidden md:block w-64 shrink-0"><Sidebar/></div><div className="md:hidden"><Sidebar/></div><main className="min-w-0 flex-1 p-2 pt-16 md:p-6">{p.get('tab')==='ALERTS'?<Alerts/>:<Tabs/>}</main></div></Provider>};createRoot(document.getElementById('root')).render(<Shell/>);`,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"test"'},plugins:[{name:'offline-boundaries',setup(builder){
    builder.onResolve({filter:/^(next\/(navigation|image|link)|@\/app\/utils\/supabase\/client|@\/app\/context\/ToastContext)$/},args=>({path:args.path,namespace:'fixture'}));
    builder.onLoad({filter:/.*/,namespace:'fixture'},args=>{
      let contents='';
      if(args.path==='next/navigation')contents=`import{useMemo,useSyncExternalStore}from'react';const subscribe=cb=>{addEventListener('popstate',cb);return()=>removeEventListener('popstate',cb)};const router={push:u=>{history.pushState({},'',u);dispatchEvent(new PopStateEvent('popstate'))},replace:u=>{history.replaceState({},'',u);dispatchEvent(new PopStateEvent('popstate'))}};export const useRouter=()=>router;export const usePathname=()=>location.pathname;export function useSearchParams(){const s=useSyncExternalStore(subscribe,()=>location.search);return useMemo(()=>new URLSearchParams(s),[s])}`;
      else if(args.path==='next/image')contents=`import React from'react';export default function Image({unoptimized,...p}){return React.createElement('img',p)}`;
      else if(args.path==='next/link')contents=`import React from'react';export default function Link(p){return React.createElement('a',p)}`;
      else if(args.path.includes('ToastContext'))contents=`const showToast=()=>{};export const useToast=()=>({showToast})`;
      else contents=`const listeners=new Set(),channels=new Set();window.dbEvent=(table,event,row)=>{for(const l of listeners)if(l.table===table&&(l.event===event||l.event==='*'))l.cb({new:event==='DELETE'?{}:row,old:event==='DELETE'?{id:row.id}:{},eventType:event})};window.reconnect=()=>{for(const c of channels)c.status?.('SUBSCRIBED')};const client={auth:{getUser:async()=>({data:{user:{id:'admin'}}})},channel:()=>{const owned=[];const c={on:(_,opts,cb)=>{const l={...opts,cb};owned.push(l);listeners.add(l);return c},subscribe:cb=>{c.status=cb;channels.add(c);return c},owned};return c},removeChannel:c=>{c.owned.forEach(l=>listeners.delete(l));channels.delete(c)}};export const createClient=()=>client;`;
      return{contents,loader:'js',resolveDir:process.cwd()};
    });
  }}]});script=bundle.outputFiles[0].text;css=(await postcss([tailwind()]).process('@import "tailwindcss";',{from:resolve('app/admin-attention-fixture.css')})).css;
});
async function setup(page: Page,phoneRace=false){
  let releaseMessages:()=>void=()=>{};const messageGate=new Promise<void>(resolve=>{releaseMessages=resolve});
  const state={unread:{1:10,2:1,3:2} as Record<number,number>,lastIds:{1:10,2:1,3:2} as Record<number,number>,alerts:143,failAck:true};const calls:string[]=[];const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const meta=(id:number)=>({inquiry_id:id,surface:id===1?'support':id===2?'phone':'monitor',admin_unread_count:state.unread[id],last_message_id:String(state.lastIds[id]),last_message_content:'새로운 문의',last_message_at:'2026-10-02T06:42Z',last_sender_role:id===3?'host':'customer',needs_reply:id===1,updated_at:'2026-10-02T06:42Z'});
  const row=(id:number)=>({id,user_id:'guest',host_id:'host',type:id===3?'general':'admin_support',status:'open',content:'새로운 문의',guest:{name:'고객'},host:{name:'호스트',id:'host'},...meta(id)});
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());if(url.hostname!=='attention.test')return route.abort();calls.push(url.pathname+url.search);
    if(url.pathname==='/api/admin/sidebar-counts'){
      const ids=url.searchParams.get('inquiryIds')?.split(',').map(Number)??[1,2,3];
      return route.fulfill({json:{success:true,data:{conversations:ids.filter(id=>state.unread[id]>0||url.searchParams.has('inquiryIds')).map(meta),adminAlertsUnread:state.alerts,appsCount:2,expsCount:3,pendingBookingCount:4,svcBankPendingCount:5}}});
    }
    if(url.pathname==='/api/admin/inquiries')return route.fulfill({json:{success:true,data:[row(url.searchParams.get('view')==='monitor'?3:1)],selection:{view:'support'},pagination:{hasMore:false}}});
    if(url.pathname==='/api/admin/customer-support'){const phone={id:'phone-2',user_id:'guest',category:'RESTAURANT',status:'COMPLETED',payment_status:'COMPLETED',profiles:{full_name:'고객'},form_data:{restaurant_name:'식당',linked_inquiry_id:'2'},linked_inquiry_id:'2',admin_unread_count:state.unread[2],needs_reply:true,needs_attention:false,latest_content:'예약 문의'};return route.fulfill({json:{success:true,data:url.searchParams.has('requestId')?phone:[phone],pagination:{hasMore:false}}});}
    if(url.pathname.endsWith('/messages')){if(phoneRace)await messageGate;const id=Number(url.pathname.split('/')[4]);return route.fulfill({json:{success:true,inquiry:row(id),data:Array.from({length:state.lastIds[id]},(_,index)=>({id:index+1,inquiry_id:id,sender_id:id===3?'host':'guest',content:'새로운 문의',type:'text',created_at:'2026-10-02T06:42Z',admin_read_at:index+1<=state.lastIds[id]-state.unread[id]?'2026-10-02T06:43Z':null}))}});}
    if(url.pathname.endsWith('/ack')){const id=Number(url.pathname.split('/')[4]);if(state.failAck)return route.fulfill({status:500,json:{success:false}});state.unread[id]=0;return route.fulfill({json:{success:true,admin_unread_count:0}});}
    if(url.pathname==='/api/admin/alerts')return route.fulfill({json:{success:true,data:[{id:1,user_id:'admin',type:'admin_alert',title:'운영 알림',message:'확인하세요',link:null,is_read:false,created_at:'2026-10-02T06:42Z'}]}});
    if(url.pathname==='/api/admin/alerts/1'){state.alerts--;return route.fulfill({json:{success:true}});}
    if(url.pathname.startsWith('/images/'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'});
    if(url.pathname==='/admin/dashboard')return route.fulfill({contentType:'text/html',body:`<style>${css}</style><div id="root"></div>`});
    return route.abort();
  });
  await page.goto('http://attention.test/admin/dashboard?tab=CHATS'+(phoneRace?'&view=phone&proxyRequestId=phone-2':''));await page.addScriptTag({content:script});
  return{state,calls,errors,releaseMessages};
}
async function sidebar(page: Page,width:number){if(width<768)await page.locator('button').filter({has:page.locator('.lucide-menu'),visible:true}).click();return page.getByRole('button',{name:/Customer Support/}).filter({visible:true});}
for(const width of [390,1280])test(`desktop/mobile ${width}: one N per conversation, three tab totals equal shared Sidebar; phone action remains separate; Alerts count includes unseen outside loaded 100`,async({page})=>{
  await page.setViewportSize({width,height:900});const f=await setup(page);
  const tabs=page.getByRole('navigation',{name:'Customer Support'});await expect(tabs.getByRole('button',{name:/1:1 문의/})).toContainText('1');await expect(tabs.getByRole('button',{name:/전화예약/})).toContainText('1');await expect(tabs.getByRole('button',{name:/실시간 모니터링/})).toContainText('1');
  await expect(page.getByTestId('admin-chat-inquiry-row-1').getByTestId('admin-conversation-new')).toHaveCount(1);
  const support=await sidebar(page,width);await expect(support).toContainText('3');await expect(page.getByRole('button',{name:/Approvals/}).filter({visible:true})).toContainText('대기 5');
  if(width<768)await support.click();
  await tabs.getByRole('button',{name:/전화예약/}).click();await expect(page.getByTestId('admin-phone-reservation-list-item').getByTestId('admin-conversation-new')).toHaveCount(1);await expect(page.getByTestId('admin-phone-reservation-list-item')).toContainText('추가 답장');
  await tabs.getByRole('button',{name:/실시간 모니터링/}).click();await expect(page.getByTestId('admin-chat-inquiry-row-3').getByTestId('admin-conversation-new')).toHaveCount(1);
  if(width<768)await sidebar(page,width);await page.getByRole('button',{name:/Admin Alerts/}).filter({visible:true}).click();await expect(page.getByRole('heading',{name:/Admin Alerts/})).toContainText('143');
  if(width<768)await sidebar(page,width);await expect(page.getByRole('button',{name:/Admin Alerts/}).filter({visible:true})).toContainText('143');await expect(page.getByRole('button',{name:/Admin Alerts/}).filter({visible:true})).toHaveAttribute('aria-current','page');
  expect(f.calls.filter(u=>u==='/api/admin/sidebar-counts'),'two sidebars share one initial store snapshot').toHaveLength(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();expect(f.errors).toEqual([]);await page.screenshot({path:test.info().outputPath(`attention-${width}.png`),fullPage:true});
});
test('actual UI: failed ACK retains N; successful rendered ACK clears it; reconnect/visibility/online restore a missed N without receipt-based guesses',async({page})=>{
  await page.setViewportSize({width:390,height:900});const f=await setup(page);const row=page.getByTestId('admin-chat-inquiry-row-1');await row.click();await expect(page.getByTestId('admin-chat-message-list')).toContainText('새로운 문의');await expect(row.getByTestId('admin-conversation-new')).toHaveCount(1);
  f.state.failAck=false;await page.evaluate(()=>dispatchEvent(new Event('online')));await expect(row.getByTestId('admin-conversation-new')).toHaveCount(0);
  await page.getByRole('button',{name:'대화 목록으로 돌아가기'}).click();
  for(const event of ['reconnect','visibility','online']){
    f.state.lastIds[1]++;f.state.unread[1]++;
    await page.evaluate(event=>{if(event==='reconnect')(window as unknown as {reconnect:()=>void}).reconnect();else if(event==='visibility')document.dispatchEvent(new Event('visibilitychange'));else dispatchEvent(new Event('online'));},event);
    await expect(row.getByTestId('admin-conversation-new')).toHaveCount(1);
  }
  const gets=f.calls.filter(u=>u.endsWith('/messages')).length;
  await page.evaluate(()=>{for(let i=0;i<10;i++)(window as unknown as {dbEvent:(t:string,e:string,r:unknown)=>void}).dbEvent('inquiry_messages','UPDATE',{id:10,inquiry_id:1,sender_id:'guest',type:'text',admin_read_at:'2026-10-02T12:00Z'});});
  await expect.poll(()=>f.calls.filter(u=>u.includes('scope=conversations')).length).toBeGreaterThan(0);
  expect(f.calls.filter(u=>u.endsWith('/messages')).length).toBe(gets);expect(f.errors).toEqual([]);
});

test('Alerts Realtime insert, primary-key-only delete, read success and reconnect keep the Sidebar and tab exact beyond the loaded list',async({page})=>{
  const f=await setup(page);await page.getByRole('button',{name:/Admin Alerts/}).filter({visible:true}).click();
  const heading=page.getByRole('heading',{name:/Admin Alerts/});await expect(heading).toContainText('143');
  const listGets=()=>f.calls.filter(url=>url==='/api/admin/alerts').length;
  const initial=listGets();f.state.alerts=144;
  await page.evaluate(()=> (window as unknown as {dbEvent:(t:string,e:string,r:unknown)=>void}).dbEvent('notifications','INSERT',{id:2,user_id:'admin',type:'admin_alert',title:'새 운영 알림',message:'새 메시지',link:null,is_read:false,created_at:'2026-10-02T06:45Z'}));
  await expect(heading).toContainText('144');await expect(page.getByText('새 운영 알림')).toBeVisible();expect(listGets()).toBe(initial);
  f.state.alerts=143;await page.evaluate(()=> (window as unknown as {dbEvent:(t:string,e:string,r:unknown)=>void}).dbEvent('notifications','DELETE',{id:2}));
  await expect(page.getByText('새 운영 알림')).toHaveCount(0);await expect(heading).toContainText('143');
  await page.getByText('운영 알림',{exact:true}).click();await expect(heading).toContainText('142');
  await expect(page.getByRole('button',{name:/Admin Alerts/}).filter({visible:true})).toContainText('142');
  f.state.alerts=145;await page.evaluate(()=> (window as unknown as {reconnect:()=>void}).reconnect());await expect(heading).toContainText('145');
  await expect(page.getByRole('button',{name:/Admin Alerts/}).filter({visible:true})).toContainText('145');expect(f.errors).toEqual([]);
});

for(const event of ['reconnect','visibility','online'])test(`real shared provider + phone workspace initial ${event}: one pending GET, serialized trailing catch-up, spinner settles`,async({page})=>{
  await page.setViewportSize({width:390,height:900});const f=await setup(page,true);
  await expect.poll(()=>f.calls.filter(url=>url.endsWith('/messages')).length).toBe(1);
  await page.evaluate(event=>{if(event==='reconnect')(window as unknown as {reconnect:()=>void}).reconnect();else if(event==='visibility')document.dispatchEvent(new Event('visibilitychange'));else dispatchEvent(new Event('online'));},event);
  await expect(page.getByTestId('admin-chat-messages-loading')).toBeVisible();expect(f.calls.filter(url=>url.endsWith('/messages')).length).toBe(1);
  f.releaseMessages();await expect(page.getByTestId('admin-chat-messages-loading')).toHaveCount(0);
  await expect(page.getByTestId('admin-chat-message-list')).toContainText('새로운 문의');
  await expect.poll(()=>f.calls.filter(url=>url.endsWith('/messages')).length).toBe(2);
  expect(f.errors).toEqual([]);
});
