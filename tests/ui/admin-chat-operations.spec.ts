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
      if (process.env.PHASE3A_BASELINE === '1') builder.onLoad({ filter: /app\/admin\/dashboard\/(components\/(ChatMonitor|PhoneReservationTab|PhonePaymentDetails)\.tsx|hooks\/useAdminChatQuery\.ts)$/ }, args => ({
        contents: execFileSync('git', ['show', `06249e0747fe3542b71f88e0819da58326ea77e3:${relative(process.cwd(), args.path)}`], { encoding: 'utf8' }), loader: args.path.endsWith('tsx') ? 'tsx' : 'ts', resolveDir: resolve(args.path, '..'),
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
  const runtimeErrors: string[] = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url()), p = url.pathname;
    if (url.hostname !== 'operations.test') return route.abort();
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body });
    if (p.startsWith('/api/')) (route.request().method() === 'GET' ? reads : mutations).push(p + url.search);
    const filters = readChatOperationsFilters(url.searchParams);
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
  if (process.env.PHASE3A_BASELINE === '1') await expect(page.locator(view === 'phone' ? '[data-testid=admin-phone-reservation-list]' : '[data-testid^=admin-chat-inquiry-row-]').first()).toBeVisible();
  else await expect(page.getByRole('checkbox', { name: 'N만', exact: true }).first()).toBeVisible();
  return { rows, requests, reads, mutations, gates, failures, messages, runtimeErrors };
}
const supportRows = (page: Page) => page.locator('[data-testid^="admin-chat-inquiry-row-"]');
const composer = (page: Page) => page.getByTestId('admin-chat-composer');
const sync = (page: Page) => page.getByTestId('admin-chat-sync').filter({ visible: true });
async function status(page: Page, value: string) { await page.evaluate(value => (window as unknown as { emitSubscriptionStatus: (v: string) => void }).emitSubscriptionStatus(value), value); }
async function copy(page: Page, phone: boolean, kind: 'id' | 'link') {
  await page.getByLabel(phone ? '전화예약 업무 메뉴' : '대화 메뉴', { exact: true }).click();
  await page.getByRole('button', { name: kind === 'id' ? '문의 ID 복사' : '대화 링크 복사', exact: true }).click();
}

for (const view of ['support', 'phone'] as const) test(`${view}: exact combined filters preserve thread, draft and URL with zero thread reload`, async ({ page }) => {
  const state = await fixture(page, view, { selected: 4 });
  await expect(composer(page)).toBeEnabled();
  const threadCount = () => state.reads.filter(url => url.endsWith('/messages')).length;
  const before = threadCount(), url = page.url();
  await composer(page).fill('보존할 초안');
  if (view === 'phone') await page.getByRole('button', { name: '전체', exact: true }).click();
  for (const name of ['N만', '답변 필요', '재문의']) await page.getByRole('checkbox', { name, exact: true }).check();
  const list = view === 'phone' ? page.getByTestId('admin-phone-reservation-list-item') : supportRows(page);
  await expect(list).toHaveCount(1);
  await expect(composer(page)).toHaveValue('보존할 초안');
  expect(page.url()).toBe(url); expect(threadCount()).toBe(before);
  await status(page, 'SUBSCRIBED');
  await expect(page.getByRole('checkbox', { name: 'N만', exact: true })).toBeChecked();
  for (const name of ['N만', '답변 필요', '재문의']) await page.getByRole('checkbox', { name, exact: true }).uncheck();
  await expect(list).toHaveCount(view === 'phone' ? 10 : 12);
  expect(state.runtimeErrors).toEqual([]);
});

for (const view of ['support', 'phone'] as const) test(`${view}: clipboard ID, canonical permalink and failure toast require no request`, async ({ page }) => {
  const state = await fixture(page, view, { selected: 4 });
  await expect(composer(page)).toBeEnabled();
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { (window as unknown as { copied: string }).copied = text; } } }); });
  const before = state.reads.length + state.mutations.length;
  await copy(page, view === 'phone', 'id');
  expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe('4');
  await copy(page, view === 'phone', 'link');
  expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe(`http://operations.test/admin/dashboard?tab=CHATS&view=${view}&${view === 'phone' ? 'proxyRequestId=request-4' : 'inquiryId=4'}`);
  await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('denied'); }; });
  await copy(page, view === 'phone', 'id');
  await expect.poll(() => page.evaluate(() => (window as unknown as { lastToast: string }).lastToast)).toBe('복사하지 못했습니다. 클립보드 권한을 확인해주세요.');
  expect(state.reads.length + state.mutations.length).toBe(before);
});

for (const view of ['support', 'phone'] as const) test(`${view}: keyboard filtered order, boundaries, typing exclusion and history`, async ({ page }) => {
  await fixture(page, view);
  await page.getByRole('checkbox', { name: '답변 필요', exact: true }).check();
  const list = view === 'phone' ? page.getByTestId('admin-phone-reservation-list-item') : supportRows(page);
  await expect(list).toHaveCount(2);
  const ids = await list.evaluateAll(elements => elements.map(element => element.getAttribute('data-testid')!.replace('admin-chat-inquiry-row-', '')));
  // Both phone pending rows and support needs_reply rows are 2 then 4.
  if (view === 'support') expect(ids).toEqual(['2', '4']);
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  await page.keyboard.press('Alt+ArrowDown');
  await expect(composer(page)).toBeEnabled();
  await expect(page).toHaveURL(new RegExp(view === 'phone' ? 'proxyRequestId=request-2' : 'inquiryId=2'));
  await composer(page).fill('입력 유지');
  await composer(page).press('Alt+ArrowDown');
  await expect(page).toHaveURL(new RegExp(view === 'phone' ? 'proxyRequestId=request-2' : 'inquiryId=2'));
  await composer(page).press('ArrowDown');
  for (const tag of ['input', 'select', 'div']) {
    await page.evaluate(tag => { const element = document.createElement(tag); element.id = 'typing-exclusion'; if (tag === 'div') element.contentEditable = 'true'; document.body.append(element); element.focus(); }, tag);
    await page.keyboard.press('Alt+ArrowDown');
    await expect(page).toHaveURL(new RegExp(view === 'phone' ? 'proxyRequestId=request-2' : 'inquiryId=2'));
    await page.evaluate(() => document.getElementById('typing-exclusion')?.remove());
  }
  await page.getByRole('button', { name: '다음 대화', exact: true }).focus();
  await page.keyboard.press('Alt+ArrowDown');
  await expect(page).toHaveURL(new RegExp(view === 'phone' ? 'proxyRequestId=request-4' : 'inquiryId=4'));
  await expect(composer(page)).toBeEnabled();
  await expect(page.getByRole('button', { name: '다음 대화', exact: true })).toBeDisabled();
  await page.keyboard.press('Alt+ArrowDown');
  await page.keyboard.press('Alt+ArrowUp');
  await expect(page).toHaveURL(new RegExp(view === 'phone' ? 'proxyRequestId=request-2' : 'inquiryId=2'));
  await expect(composer(page)).toHaveValue('입력 유지');
  await expect(page.getByRole('button', { name: '이전 대화', exact: true })).toBeDisabled();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(view === 'phone' ? 'proxyRequestId=request-4' : 'inquiryId=4'));
});

test('keyboard A→B→A does not accept delayed prior A or stale loading ownership', async ({ page }) => {
  const state = await fixture(page);
  let release!: () => void;
  state.gates.set(1, new Promise<void>(resolve => { release = resolve; }));
  await page.getByTestId('admin-chat-inquiry-row-1').click();
  await expect(page.getByTestId('admin-chat-messages-loading')).toBeVisible();
  await page.getByRole('button', { name: '다음 대화', exact: true }).focus();
  await page.keyboard.press('Alt+ArrowDown');
  await expect(page).toHaveURL(/inquiryId=3$/);
  await expect(composer(page)).toBeEnabled();
  state.messages.set(1, [{ id: 101, inquiry_id: 1, sender_id: 'guest', content: '최신 A', type: 'text', created_at: '2026-10-03T00:00Z' }]);
  state.gates.delete(1);
  await page.getByRole('button', { name: '이전 대화', exact: true }).focus();
  await page.keyboard.press('Alt+ArrowUp');
  await expect(page.getByTestId('admin-chat-message-list')).toContainText('최신 A');
  release();
  await expect(page.getByTestId('admin-chat-message-list')).not.toContainText('대화 내용 1');
  await expect(page.getByTestId('admin-chat-messages-loading')).toHaveCount(0);
});

test('connection visibility follows existing subscription, offline and successful catchup', async ({ page }) => {
  const state = await fixture(page, 'support', { selected: 4 });
  await expect(composer(page)).toBeEnabled();
  await expect(sync(page).first()).toContainText('연결 확인 중');
  await status(page, 'SUBSCRIBED');
  await expect(sync(page).first()).toHaveAttribute('data-state', 'connected');
  await expect(sync(page).first()).toContainText(/마지막 동기화 \d{2}:\d{2} KST/);
  await status(page, 'TIMED_OUT');
  await expect(sync(page).first()).toHaveAttribute('data-state', 'reconnecting');
  const before = state.reads.length;
  await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }); window.dispatchEvent(new Event('offline')); });
  await expect(sync(page).first()).toHaveAttribute('data-state', 'offline');
  expect(state.reads.length).toBe(before);
  await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); window.dispatchEvent(new Event('online')); });
  await status(page, 'SUBSCRIBED');
  await expect(sync(page).first()).toHaveAttribute('data-state', 'connected');
});

for (const view of ['support', 'phone'] as const) for (const width of [390, 1280]) test(`${view} compact toolbar, filters, menu, composer and KST at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await fixture(page, view);
  if (view === 'phone') await page.getByRole('button', { name: '전체', exact: true }).click();
  const list = view === 'phone' ? page.getByTestId('admin-phone-reservation-list-item') : supportRows(page);
  await expect(list.first()).toBeVisible();
  if (view === 'phone') await expect(page.getByTestId('admin-phone-list-timestamp').first()).toHaveText('10. 03. 00:21');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await list.first().click();
  await expect(composer(page)).toBeVisible();
  const box = await composer(page).boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(900);
  await page.getByLabel(view === 'phone' ? '전화예약 업무 메뉴' : '대화 메뉴', { exact: true }).click();
  const action = await page.getByRole('button', { name: '대화 링크 복사', exact: true }).boundingBox();
  expect(action!.x).toBeGreaterThanOrEqual(0); expect(action!.x + action!.width).toBeLessThanOrEqual(width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  mkdirSync('.tmp/phase3a', { recursive: true });
  await page.screenshot({ path: `.tmp/phase3a/${test.info().project.name}-${view}-${width}.png`, fullPage: true });
});

for (const view of ['support', 'phone'] as const) test(`${view} performance: actual starting main vs current idle/initial/switch/message/burst/filter/next10`, async ({ page }) => {
  await page.clock.install();
  const baseline = process.env.PHASE3A_BASELINE === '1';
  const state = await fixture(page, view, { performance: true });
  if (view === 'phone') await page.getByRole('button', { name: '전체', exact: true }).click();
  const list = view === 'phone' ? page.getByTestId('admin-phone-reservation-list-item') : supportRows(page);
  await expect(list.first()).toBeVisible();
  const metrics = () => ({ list: state.reads.filter(p => view === 'phone' ? p.includes('customer-support?filter=') : p.includes('inquiries?') && !p.includes('resolveOnly')).length,
    detail: state.reads.filter(p => p.includes('requestId=')).length, resolve: state.reads.filter(p => p.includes('resolveOnly')).length,
    thread: state.reads.filter(p => p.endsWith('/messages')).length, ack: state.mutations.filter(p => p.endsWith('/ack')).length });
  const reset = () => { state.reads.length = 0; state.mutations.length = 0; };
  const initial = metrics(); reset();
  await list.first().click(); await expect(composer(page)).toBeEnabled(); const switching = metrics(); reset();
  await status(page, 'SUBSCRIBED'); await page.clock.runFor(1000); await expect(composer(page)).toBeEnabled();
  // Resolve the router's enable/disable transition before marking the active channel healthy.
  await status(page, 'SUBSCRIBED'); await page.clock.runFor(1000); reset();
  await page.clock.runFor(600_000); const idle = metrics(); reset();
  const emit = async (count: number, base: number) => {
    const rows = Array.from({ length: count }, (_, n) => ({ id: base + n, inquiry_id: 1, sender_id: 'guest', content: `추가 ${base + n}`, type: 'text', created_at: '2026-10-03T00:00Z' }));
    state.messages.get(1)!.push(...rows);
    await page.evaluate(rows => { for (const row of rows) (window as unknown as { emitDatabaseChange: (t: string, e: string, r: unknown) => void }).emitDatabaseChange('inquiry_messages', 'INSERT', row); }, rows);
    await page.clock.runFor(1000); await expect(page.getByTestId('admin-chat-message-list')).toContainText(`추가 ${base + count - 1}`);
    const value = metrics(); reset(); return value;
  };
  const one = await emit(1, 900), burst = await emit(10, 910);
  if (baseline) {
    // Existing status filters cost one list refresh; operational filters should have the same cost.
    await page.getByRole('button', { name: view === 'phone' ? '종료' : '대기', exact: true }).first().click();
  } else await page.getByRole('checkbox', { name: '재문의', exact: true }).check();
  await page.clock.runFor(1000); const filter = metrics(); reset();
  if (baseline) await page.getByRole('button', { name: '전체', exact: true }).first().click();
  else await page.getByRole('checkbox', { name: '재문의', exact: true }).uncheck();
  await page.clock.runFor(1000); reset();
  if (view === 'phone') { await page.getByTestId('admin-phone-reservation-load-more-button').click(); await page.clock.runFor(1000); }
  // Advancing the browser clock does not wait for the filter-clear response.
  await expect(list).toHaveCount(12); reset();
  for (let id = 2; id <= 11; id++) {
    if (baseline) await list.nth(id - 1).click();
    else { await page.getByRole('button', { name: '다음 대화', exact: true }).focus(); await page.keyboard.press('Alt+ArrowDown'); }
    await expect(page).toHaveURL(new RegExp(view === 'phone' ? `proxyRequestId=request-${id}$` : `inquiryId=${id}$`));
    await expect(composer(page)).toBeEnabled();
    await page.clock.runFor(1000);
  }
  const next10 = metrics();
  console.log('PHASE3A_WORKLOAD', JSON.stringify({ source: baseline ? 'starting-main' : 'current', view, initial, switching, idle, one, burst, filter, next10 }));
  if (!baseline) expect(filter.thread).toBe(0);
  expect(state.runtimeErrors).toEqual([]);
});
