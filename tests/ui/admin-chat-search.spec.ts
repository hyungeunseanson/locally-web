import { expect, test, type Page } from '@playwright/test';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { matchesChatOperations, readChatOperationsFilters } from '@/app/utils/adminChatOperations';

let script: string, css: string;
test.beforeAll(async () => {
  const bundle = await build({
    entryPoints: ['tests/ui/fixtures/phone-workspace-entry.tsx'], bundle: true, write: false, format: 'iife', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"test"' },
    plugins: [{ name: 'local-operations-boundaries', setup(builder) {
      if (process.env.PHASE3B_BASELINE === '1') builder.onLoad({ filter: /app\/admin\/dashboard\/(components\/(ChatMonitor|PhoneReservationTab|PhonePaymentDetails)\.tsx|hooks\/useAdminChatQuery\.ts)$/ }, args => ({
        contents: execFileSync('git', ['show', `3dfb32870c14223649abbc9dd86e9471b3a4faa5:${relative(process.cwd(), args.path)}`], { encoding: 'utf8' }), loader: args.path.endsWith('tsx') ? 'tsx' : 'ts', resolveDir: resolve(args.path, '..'),
      }));
      builder.onResolve({ filter: /^(next\/navigation|next\/image|@\/app\/utils\/supabase\/client|@\/app\/context\/ToastContext)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => {
        let contents: string;
        if (args.path === 'next/navigation') contents = `import {useMemo,useSyncExternalStore} from 'react';
          const subscribe=cb=>{addEventListener('popstate',cb);return()=>removeEventListener('popstate',cb)};
          const router={push:url=>{history.pushState({},'',url);dispatchEvent(new PopStateEvent('popstate'))},replace:url=>{history.replaceState({},'',url);dispatchEvent(new PopStateEvent('popstate'))}};
          export const useRouter=()=>router;export const usePathname=()=>location.pathname;
          export function useSearchParams(){const s=useSyncExternalStore(subscribe,()=>location.search);return useMemo(()=>new URLSearchParams(s),[s])}`;
        else if (args.path === 'next/image') contents = `import React from 'react';export default function Image({unoptimized,...props}){return React.createElement('img',props)}`;
        else if (args.path.includes('ToastContext')) contents = `const showToast=(message)=>{window.lastToast=message};export const useToast=()=>({showToast})`;
        else contents = `const listeners=new Set(),statuses=new Set();
          window.emitSubscriptionStatus=s=>{for(const cb of statuses)cb(s)};
          window.emitDatabaseChange=(table,event,row)=>{for(const l of listeners)if(l.table===table&&(l.event===event||l.event==='*'))l.cb({new:row,eventType:event})};
          const client={auth:{getUser:async()=>({data:{user:{id:'admin'}}})},channel:()=>{const owned=[];const c={on:(_,opts,cb)=>{const l={...opts,cb};listeners.add(l);owned.push(l);return c},subscribe:cb=>{if(cb){statuses.add(cb);c.status=cb}return c},owned};return c},removeChannel:c=>{c.owned.forEach(l=>listeners.delete(l));statuses.delete(c.status)}};export const createClient=()=>client;`;
        return { contents, loader: 'js', resolveDir: process.cwd() };
      });
    } }],
  });
  script = bundle.outputFiles[0].text;
  css = (await postcss([tailwind()]).process('@import "tailwindcss";', { from: resolve('app/operations-fixture.css') })).css;
});

type Message = { id: number; sender_id: string; content: string; type: string; created_at: string; inquiry_id: number };
async function fixture(page: Page, view: 'support' | 'phone' = 'support', options: { performance?: boolean; selected?: number } = {}) {
  const rows = Array.from({ length: 12 }, (_, n) => ({ id: n + 1, user_id: 'guest', type: 'admin_support', status: 'open',
    guest: { name: `고객 ${n + 1}` }, content: `문의 ${n + 1}`, updated_at: `2026-10-03T00:${String(59 - n).padStart(2, '0')}:00Z`,
    admin_unread_count: options.performance ? 0 : n === 0 ? 10 : n === 3 ? 1 : 0,
    needs_reply: options.performance ? false : n === 1 || n === 3, support_reopened_at: n === 2 || n === 3 ? '2026-10-02T15:01Z' : null,
  }));
  const requests = rows.map(row => ({ id: `request-${row.id}`, user_id: 'guest', category: 'RESTAURANT', status: 'COMPLETED',
    profiles: { full_name: row.guest.name }, linked_inquiry_id: String(row.id), admin_unread_count: row.admin_unread_count,
    needs_reply: row.needs_reply, needs_attention: false, support_reopened_at: row.support_reopened_at,
    latest_created_at: '2026-10-02T15:21Z', created_at: '2026-10-02T15:00Z', updated_at: '2026-10-02T15:21Z',
    payment_status: 'COMPLETED', payment_channel: 'LOCALLY', form_data: { restaurant_name: `식당 ${row.id}`, linked_inquiry_id: String(row.id), payment_method: 'card' },
  }));
  const messages = new Map<number, Message[]>(rows.map(row => [row.id, [{ id: row.id * 100, inquiry_id: row.id, sender_id: 'guest', content: `대화 내용 ${row.id}`, type: 'text', created_at: '2026-10-02T15:21Z' }]]));
  const reads: string[] = [], mutations: string[] = [];
  const gates = new Map<number, Promise<void>>();
  const failures = new Set<number>();
  const searchGates = new Map<string, Promise<void>>();
  const searchFailures = new Set<string>();
  const runtimeErrors: string[] = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url()), p = url.pathname;
    if (url.hostname !== 'operations.test') return route.abort();
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body });
    if (p.startsWith('/api/')) (route.request().method() === 'GET' ? reads : mutations).push(p + url.search);
    const filters = readChatOperationsFilters(url.searchParams);
    if (p === '/api/admin/chat-search') {
      const q = url.searchParams.get('q')!;
      if (searchGates.has(q)) await searchGates.get(q);
      if (searchFailures.has(q)) return json({ success: false }, 500);
      const ids = q === 'none' ? [] : q === 'second' ? [2] : q === 'broad' ? Array.from({length:40},(_,n)=>n+1) : [1];
      return json({ success: true, data: ids.map(id => ({ id: view === 'phone' ? `request-${id}` : String(id), customer_name: `고객 ${id}`, customer_email: `guest${id}@example.test`, title: `상품 ${id}` })) });
    }
    if (p === '/api/admin/inquiries') {
      const selected = rows.find(row => String(row.id) === url.searchParams.get('inquiryId'));
      if (url.searchParams.has('resolveOnly')) return json({ success: true, selection: { view: 'support' }, data: [] });
      const data = rows.filter(row => matchesChatOperations(row, filters));
      if (selected && !data.includes(selected)) data.unshift(selected);
      return json({ success: true, data, pagination: { hasMore: false } });
    }
    if (p === '/api/admin/customer-support') {
      const id = url.searchParams.get('requestId');
      const base = url.searchParams.get('filter');
      const matching = requests.filter(row => (base !== 'todo' || row.needs_reply) && matchesChatOperations(row, filters));
      const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 10);
      return json({ success: true, data: id ? requests.find(row => row.id === id) : matching.slice(offset, offset + limit), pagination: { hasMore: matching.length > offset + limit } });
    }
    if (/\/inquiries\/\d+\/messages$/.test(p)) {
      const id = Number(p.split('/')[4]);
      // Freeze the response before the gate, modelling a genuinely stale GET.
      const data = messages.get(id)!.map(row => ({ ...row })), inquiry = { ...rows[id - 1] };
      if (gates.has(id)) await gates.get(id);
      return failures.has(id) ? json({ success: false }, 500) : json({ success: true, data, inquiry });
    }
    if (p.endsWith('/ack')) return json({ success: true, admin_unread_count: rows[Number(p.split('/')[4]) - 1].admin_unread_count });
    if (p === '/admin/dashboard') return route.fulfill({ contentType: 'text/html', body: `<style>${css}</style><div style="padding:12px" id="root"></div><script>${script}</script>` });
    return route.abort();
  });
  await page.goto(`http://operations.test/admin/dashboard?tab=CHATS&view=${view}${options.selected ? view === 'phone' ? `&proxyRequestId=request-${options.selected}` : `&inquiryId=${options.selected}` : ''}`);
  if (process.env.PHASE3B_BASELINE === '1') await expect(page.locator(view === 'phone' ? '[data-testid=admin-phone-reservation-list]' : '[data-testid^=admin-chat-inquiry-row-]').first()).toBeVisible();
  else await expect(page.getByRole('checkbox', { name: 'N만', exact: true }).first()).toBeVisible();
  return { rows, requests, reads, mutations, gates, failures, searchGates, searchFailures, messages, runtimeErrors };
}
const supportRows = (page: Page) => page.locator('[data-testid^="admin-chat-inquiry-row-"]');
const composer = (page: Page) => page.getByTestId('admin-chat-composer');
async function status(page: Page, value: string) { await page.evaluate(value => (window as unknown as { emitSubscriptionStatus: (v: string) => void }).emitSubscriptionStatus(value), value); }
const input = (page: Page, view: 'support' | 'phone') => page.getByRole('textbox', { name: view === 'phone' ? '전화예약 검색' : '1:1 문의 검색', exact: true });
const resultRows = (page: Page) => page.getByTestId('admin-chat-search-result');
const searchCount = (reads: string[]) => reads.filter(url => url.startsWith('/api/admin/chat-search?')).length;
const threadCount = (reads: string[]) => reads.filter(url => url.endsWith('/messages')).length;

for (const view of ['support','phone'] as const) test(`${view}: minimum, debounce, rapid query, empty, error, retry, clear and bounded results`, async ({page}) => {
  await page.clock.install({time:new Date('2026-10-03T00:00:00Z')});
  await page.clock.pauseAt(new Date('2026-10-03T00:00:01Z'));
  const f = await fixture(page,view);
  expect(searchCount(f.reads)).toBe(0);
  await input(page,view).fill('a'); await page.clock.runFor(1000);
  expect(searchCount(f.reads)).toBe(0);
  await input(page,view).fill('first'); await page.clock.runFor(300);
  await input(page,view).fill('second'); await page.clock.runFor(399);
  expect(searchCount(f.reads)).toBe(0);
  await page.clock.runFor(1); await expect(resultRows(page)).toHaveCount(1);
  expect(searchCount(f.reads)).toBe(1); await expect(resultRows(page)).toContainText('고객 2');
  await input(page,view).fill('second '); await page.clock.runFor(500);
  expect(searchCount(f.reads)).toBe(1); await expect(resultRows(page)).toContainText('고객 2');
  await input(page,view).fill('none'); await page.clock.runFor(400);
  await expect(page.getByTestId('admin-chat-search').filter({visible:true})).toHaveAttribute('data-state','empty');
  f.searchFailures.add('broken'); await input(page,view).fill('broken'); await page.clock.runFor(400);
  await expect(page.getByTestId('admin-chat-search').filter({visible:true})).toHaveAttribute('data-state','error');
  f.searchFailures.delete('broken'); await page.getByRole('button',{name:'다시 시도',exact:true}).click(); await page.clock.runFor(400);
  await expect(resultRows(page)).toHaveCount(1);
  await input(page,view).fill('broad'); await page.clock.runFor(400); await expect(resultRows(page)).toHaveCount(25);
  const before = f.reads.length;
  await page.getByRole('button',{name:'검색 지우기'}).click(); await page.clock.runFor(1000);
  await expect(page.getByTestId('admin-chat-search').filter({visible:true})).toHaveAttribute('data-state','idle');
  await expect(resultRows(page)).toHaveCount(0); expect(f.reads.length).toBe(before);
  expect(f.runtimeErrors).toEqual([]);
});

for (const view of ['support','phone'] as const) test(`${view}: immediate cancellation and stale response ignored even when transport ignores abort`, async ({page}) => {
  await page.clock.install(); const f = await fixture(page,view);
  await page.evaluate(() => {
    const original=window.fetch.bind(window);
    const calls: {q:string;signal:AbortSignal;resolve:(body:unknown)=>void}[]=[];
    (window as unknown as {searchFlights:typeof calls}).searchFlights=calls;
    window.fetch=(url,options)=> {
      if(!String(url).startsWith('/api/admin/chat-search?')) return original(url,options);
      const q=new URL(String(url),location.origin).searchParams.get('q')!;
      return new Promise<Response>(resolve=>calls.push({q,signal:options!.signal!,resolve:body=>resolve(new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}}))}));
    };
  });
  await input(page,view).fill('first'); await page.clock.runFor(400);
  await input(page,view).fill('first ');
  expect(await page.evaluate(()=>(window as unknown as {searchFlights:{signal:AbortSignal}[]}).searchFlights[0].signal.aborted)).toBe(false);
  await input(page,view).fill('second');
  expect(await page.evaluate(()=>(window as unknown as {searchFlights:{signal:AbortSignal}[]}).searchFlights[0].signal.aborted)).toBe(true);
  await expect(resultRows(page)).toHaveCount(0);
  await page.clock.runFor(400);
  await page.evaluate(() => {
    const f=(window as unknown as {searchFlights:{resolve:(v:unknown)=>void}[]}).searchFlights;
    f[1].resolve({success:true,data:[{id:'2',customer_name:'최신 결과'}]});
  });
  await expect(resultRows(page)).toContainText('최신 결과');
  await page.evaluate(()=>(window as unknown as {searchFlights:{resolve:(v:unknown)=>void}[]}).searchFlights[0].resolve({success:true,data:[{id:'1',customer_name:'오래된 결과'}]}));
  await expect(resultRows(page)).toContainText('최신 결과'); await expect(resultRows(page)).not.toContainText('오래된 결과');
  await input(page,view).fill('third'); await page.clock.runFor(400); await page.getByRole('button',{name:'검색 지우기'}).click();
  expect(await page.evaluate(()=>(window as unknown as {searchFlights:{signal:AbortSignal}[]}).searchFlights[2].signal.aborted)).toBe(true);
  await page.evaluate(()=>(window as unknown as {searchFlights:{resolve:(v:unknown)=>void}[]}).searchFlights[2].resolve({success:true,data:[{id:'3',customer_name:'지운 결과'}]}));
  await expect(resultRows(page)).toHaveCount(0); expect(threadCount(f.reads)).toBe(0);
});

for (const view of ['support','phone'] as const) test(`${view}: result canonical selection, deep link, drafts A→B→A and zero thread reload while typing`, async ({page}) => {
  const f = await fixture(page,view,{selected:1}); await expect(composer(page)).toBeEnabled();
  await composer(page).fill('A 초안'); const before=threadCount(f.reads), url=page.url();
  await input(page,view).fill('second'); await expect(resultRows(page)).toContainText('고객 2');
  expect(threadCount(f.reads)).toBe(before); expect(page.url()).toBe(url); await expect(composer(page)).toHaveValue('A 초안');
  await resultRows(page).click(); await expect(page).toHaveURL(new RegExp(view==='phone'?'proxyRequestId=request-2':'inquiryId=2'));
  await expect(composer(page)).toBeEnabled(); expect(threadCount(f.reads)).toBe(before+1);
  await composer(page).fill('B 초안'); await input(page,view).fill('first'); await expect(resultRows(page)).toContainText('고객 1');
  await resultRows(page).click(); await expect(composer(page)).toHaveValue('A 초안'); expect(threadCount(f.reads)).toBe(before+2);
  await page.goBack(); await expect(composer(page)).toHaveValue('B 초안');
  const current=page.url(); await page.reload(); await expect(composer(page)).toBeEnabled(); expect(page.url()).toBe(current);
  expect(f.runtimeErrors).toEqual([]);
});

test('search result A→B→A retains latest thread and loading ownership with prior A delayed', async ({page}) => {
  const f=await fixture(page); let release!:()=>void;
  f.gates.set(1,new Promise<void>(resolve=>{release=resolve;}));
  await input(page,'support').fill('first'); await expect(resultRows(page)).toContainText('고객 1'); await resultRows(page).click();
  await expect(page.getByTestId('admin-chat-messages-loading')).toBeVisible();
  // Canonical URL resolution hides the support surface temporarily while routing.
  await input(page,'support').fill('second'); await expect(resultRows(page)).toContainText('고객 2'); await resultRows(page).click();
  await expect(composer(page)).toBeEnabled();
  f.gates.delete(1); f.messages.set(1,[{id:101,inquiry_id:1,sender_id:'guest',content:'최신 A',type:'text',created_at:'2026-10-03T00:00Z'}]);
  await input(page,'support').fill('first'); await expect(resultRows(page)).toContainText('고객 1'); await resultRows(page).click();
  await expect(page.getByTestId('admin-chat-message-list')).toContainText('최신 A'); release();
  await expect(page.getByTestId('admin-chat-message-list')).not.toContainText('대화 내용 1');
  await expect(page.getByTestId('admin-chat-messages-loading')).toHaveCount(0);
});

for (const view of ['support','phone'] as const) for (const width of [390,1280]) test(`${view}: search layout and canonical result at ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:900}); await fixture(page,view);
  await input(page,view).fill('broad'); await expect(resultRows(page)).toHaveCount(25);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const box=await resultRows(page).first().boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x+box!.width).toBeLessThanOrEqual(width);
  mkdirSync('.tmp/phase3b',{recursive:true}); await page.screenshot({path:`.tmp/phase3b/${test.info().project.name}-${view}-${width}.png`,fullPage:true});
  await resultRows(page).first().click(); await expect(composer(page)).toBeVisible();
  const composerBox=await composer(page).boundingBox(); expect(composerBox!.y+composerBox!.height).toBeLessThanOrEqual(900);
});

for(const view of ['support','phone'] as const) test(`${view}: performance idle and no-search request parity against starting main`, async ({page}) => {
  await page.clock.install(); const f=await fixture(page,view,{performance:true});
  if(view==='phone') await page.getByRole('button',{name:'전체',exact:true}).click();
  const list=view==='phone'?page.getByTestId('admin-phone-reservation-list-item'):supportRows(page);
  await expect(list.first()).toBeVisible(); const initial=[...f.reads]; f.reads.length=0;
  await list.first().click(); await expect(composer(page)).toBeEnabled(); const selection=[...f.reads]; f.reads.length=0;
  await status(page,'SUBSCRIBED'); await page.clock.runFor(1000); await expect(composer(page)).toBeEnabled();
  await status(page,'SUBSCRIBED'); await page.clock.runFor(1000); f.reads.length=0;
  await page.clock.runFor(600_000); const idle=[...f.reads];
  expect(searchCount([...initial,...selection,...idle])).toBe(0);
  console.log('PHASE3B_REQUESTS',JSON.stringify({source:process.env.PHASE3B_BASELINE==='1'?'starting-main':'current',view,initial,selection,idle}));
});
