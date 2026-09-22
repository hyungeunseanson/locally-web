import { expect, test, type Page } from '@playwright/test';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { resolve } from 'node:path';

let script: string;
let css: string;
test.beforeAll(async () => {
  const bundle = await build({
    entryPoints: ['tests/ui/fixtures/phone-workspace-entry.tsx'], bundle: true, write: false, format: 'iife', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"test"' },
    plugins: [{ name: 'isolated-browser-boundaries', setup(builder) {
      builder.onResolve({ filter: /^(next\/navigation|next\/image|@\/app\/utils\/supabase\/client|@\/app\/context\/ToastContext)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => {
        let contents = '';
        if (args.path === 'next/navigation') contents = `
          import {useMemo,useSyncExternalStore} from 'react';
          const subscribe=cb=>{addEventListener('popstate',cb);return()=>removeEventListener('popstate',cb)};
          const router={push:url=>{history.pushState({},'',url);dispatchEvent(new PopStateEvent('popstate'))},replace:url=>{history.replaceState({},'',url);dispatchEvent(new PopStateEvent('popstate'))}};
          export const useRouter=()=>router;
          export const usePathname=()=>location.pathname;
          export function useSearchParams(){const search=useSyncExternalStore(subscribe,()=>location.search);return useMemo(()=>new URLSearchParams(search),[search])}`;
        else if (args.path === 'next/image') contents = `import React from 'react';export default function Image({unoptimized,...props}){return React.createElement('img',props)}`;
        else if (args.path.includes('ToastContext')) contents = `const showToast=(message)=>{window.lastToast=message};export const useToast=()=>({showToast})`;
        else contents = `const listeners=new Set(); window.emitDatabaseChange=(table,event,row)=>{for(const l of listeners)if(l.table===table&&(l.event===event||l.event==='*'))l.cb({new:row,eventType:event})};
          const client={auth:{getUser:async()=>({data:{user:{id:'admin'}}})},channel:()=>{const owned=[];const c={on:(_,opts,cb)=>{const l={...opts,cb};listeners.add(l);owned.push(l);return c},subscribe:()=>c,owned};return c},removeChannel:c=>c.owned.forEach(l=>listeners.delete(l))};export const createClient=()=>client;`;
        return { contents, loader: 'js', resolveDir: process.cwd() };
      });
    } }],
  });
  script = bundle.outputFiles[0].text;
  css = (await postcss([tailwind()]).process('@import "tailwindcss";', { from: resolve('app/phone-fixture.css') })).css;
});

async function fixture(page: Page, options: { failSend?: boolean; failComplete?: boolean; unpaid?: boolean; status?: string; inquiryId?: string } = {}) {
  const request = {
    id: 'request-1', user_id: 'guest', category: 'RESTAURANT', status: options.status || 'PENDING',
    payment_status: options.unpaid ? 'WAITING' : 'COMPLETED', payment_channel: 'LOCALLY',
    form_data: { payment_method: options.unpaid ? 'bank' : 'card', restaurant_name: '스시 테스트', restaurant_phone: '0312345678', google_map_url: 'https://example.com/map', preferred_slot_primary: '2026-09-25T19:00', guest_number: 2, reservation_name: '홍길동', linked_inquiry_id: '123', request_notes: '창가 자리' },
    profiles: { full_name: '홍길동' }, linked_inquiry_id: '123', needs_attention: false, needs_reply: false,
    latest_sender_id: 'guest', latest_content: '예약해주세요', created_at: '2026-09-22T00:00:00Z',
  };
  const messages = [{ id: 1, sender_id: 'guest', content: '예약해주세요', type: 'text', sender: { name: '홍길동' } }];
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  let failComplete = options.failComplete;
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'phone.test') return route.abort();
    const path = url.pathname;
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body });
    if (path === '/api/admin/customer-support') {
      const latest = messages.at(-1)!;
      request.latest_sender_id = latest.sender_id;
      request.needs_reply = request.status === 'COMPLETED' && latest.sender_id === 'guest';
      const filter = url.searchParams.get('filter');
      const matching = filter === 'all' || filter === 'closed' && request.status === 'COMPLETED' && !request.needs_reply
        || filter === 'todo' && (request.needs_reply || request.status !== 'COMPLETED' && request.payment_status === 'COMPLETED')
        || filter === 'payment' && request.payment_status === 'WAITING';
      return json({ success: true, data: url.searchParams.has('requestId') ? request : matching ? [request] : [], pagination: { hasMore: false } });
    }
    if (path === '/api/admin/inquiries') {
      const id = url.searchParams.get('inquiryId');
      const monitor = id === '456' || url.searchParams.get('view') === 'monitor';
      return json({ success: true, selection: id === '123' ? { view: 'phone', proxyRequestId: 'request-1' } : { view: monitor ? 'monitor' : 'support' },
        data: [{ id: monitor ? '456' : '789', user_id: 'guest', type: monitor ? 'general' : 'admin_support', guest: { name: '일반 고객' }, content: '일반 문의' }], pagination: { hasMore: false } });
    }
    if (/\/api\/admin\/inquiries\/\w+\/messages/.test(path)) return json({ success: true, data: messages, inquiry: { id: url.pathname.split('/')[4], user_id: 'guest', type: path.includes('456') ? 'general' : 'admin_support', guest: { name: '홍길동' } } });
    if (path === '/api/inquiries/message') {
      const body = route.request().postDataJSON(); calls.push({ path, body });
      if (options.failSend) return json({ success: false, error: '전송 실패' }, 500);
      messages.push({ id: messages.length + 1, sender_id: 'admin', content: body.content, type: 'text', sender: { name: '관리자' } });
      return json({ success: true, inquiryId: body.inquiryId, messageId: messages.length, displayContent: body.content, updatedAt: new Date().toISOString() });
    }
    if (path === '/api/proxy-bookings/request-1') {
      calls.push({ path, body: route.request().postDataJSON() });
      if (failComplete || request.payment_status !== 'COMPLETED') { failComplete = false; return json({ success: false, error: '완료 처리 실패' }, 409); }
      request.status = 'COMPLETED'; return json({ success: true });
    }
    if (path.startsWith('/api/')) return json({ success: true });
    return route.fulfill({ contentType: 'text/html', body: `<html><head><style>${css}</style></head><body><main style="padding:16px"><div id="root"></div></main><script>${script.replaceAll('</script', '<\\/script')}</script></body></html>` });
  });
  await page.goto(`http://phone.test/admin/dashboard?tab=CHATS&${options.inquiryId ? `inquiryId=${options.inquiryId}` : 'view=phone&proxyRequestId=request-1'}`);
  return { calls, request, messages };
}

for (const status of ['PENDING', 'IN_PROGRESS']) test(`paid ${status}: sends once then completes without navigation`, async ({ page }) => {
  const state = await fixture(page, { status });
  await page.getByTestId('admin-chat-composer').filter({ visible: true }).fill('예약 결과입니다.');
  await page.getByRole('button', { name: '안내 보내고 완료', exact: true }).click();
  await expect.poll(() => state.request.status).toBe('COMPLETED');
  expect(state.calls.map(call => call.path)).toEqual(['/api/inquiries/message', '/api/proxy-bookings/request-1']);
  await expect(page.getByTestId('admin-chat-message-list').filter({ visible: true }).getByText('예약 결과입니다.')).toBeVisible();
});

test('partial completion failure retries status only and keeps the pending state across tabs', async ({ page }) => {
  const state = await fixture(page, { failComplete: true });
  await page.getByTestId('admin-chat-composer').filter({ visible: true }).fill('안내 전송');
  await page.getByRole('button', { name: '안내 보내고 완료', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('고객 안내는 전송됐지만 완료 처리에 실패했습니다.');
  await page.getByRole('navigation').getByRole('button', { name: '1:1 문의', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: '전화예약', exact: true }).click();
  await page.getByTestId('admin-phone-reservation-list-item').click();
  await page.getByRole('button', { name: '완료 처리 다시 시도' }).click();
  await expect.poll(() => state.request.status).toBe('COMPLETED');
  expect(state.calls.filter(call => call.path === '/api/inquiries/message')).toHaveLength(1);
  expect(state.calls.filter(call => call.path === '/api/proxy-bookings/request-1')).toHaveLength(2);
});

test('send failure does not complete; draft remains', async ({ page }) => {
  const state = await fixture(page, { failSend: true });
  const input = page.getByTestId('admin-chat-composer').filter({ visible: true });
  await input.fill('남아야 하는 답변');
  await page.getByRole('button', { name: '안내 보내고 완료', exact: true }).click();
  await expect(input).toBeEnabled();
  await expect(input).toHaveValue('남아야 하는 답변');
  expect(state.calls.filter(call => call.path.includes('/proxy-bookings/'))).toHaveLength(0);
});

test('unpaid completion disabled; ordinary reply changes no request status', async ({ page }) => {
  const state = await fixture(page, { unpaid: true });
  await page.getByTestId('admin-chat-composer').filter({ visible: true }).fill('입금을 확인하겠습니다.');
  await expect(page.getByRole('button', { name: '안내 보내고 완료', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '입금 확인', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '답변 보내기', exact: true }).click();
  await expect.poll(() => state.calls.length).toBe(1);
  expect(state.request.status).toBe('PENDING');
});

test('completed customer follow-up returns to todo until admin replies, without reopening request', async ({ page }) => {
  const state = await fixture(page, { status: 'COMPLETED' });
  await expect(page.getByTestId('admin-phone-reservation-list-item')).toContainText('추가 답장');
  await page.getByTestId('admin-chat-composer').filter({ visible: true }).fill('추가 답변');
  await page.getByRole('button', { name: '답변 보내기', exact: true }).click();
  await expect(page.getByTestId('admin-phone-reservation-list-item')).toHaveCount(0);
  expect(state.request.status).toBe('COMPLETED');
  expect(state.calls).toHaveLength(1);
});

for (const [id, view] of [['123', 'phone'], ['456', 'monitor'], ['789', 'support']]) test(`legacy inquiry ${id} resolves to ${view}`, async ({ page }) => {
  await fixture(page, { inquiryId: id });
  await expect(page).toHaveURL(new RegExp(`view=${view}`));
  if (view === 'phone') await expect(page).toHaveURL(/proxyRequestId=request-1/);
});

test('mobile back keeps filter/search and draft; templates never send automatically', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await fixture(page);
  await page.getByRole('button', { name: '예약 확정', exact: true }).click();
  await expect(page.getByTestId('admin-chat-composer').filter({ visible: true })).toHaveValue(/예약 결과를 입력해주세요/);
  expect(state.calls).toHaveLength(0);
  await page.getByRole('button', { name: '← 목록으로', exact: true }).click();
  await page.getByRole('button', { name: '전체', exact: true }).click();
  await page.getByRole('textbox', { name: '전화예약 검색' }).fill('홍길동');
  await page.getByTestId('admin-phone-reservation-list-item').click();
  await expect(page.getByTestId('admin-chat-composer').filter({ visible: true })).toHaveValue(/예약 결과를 입력해주세요/);
  const box = await page.getByRole('button', { name: '안내 보내고 완료', exact: true }).boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '.tmp/phone-validation/mobile.png', fullPage: true });
});

test('desktop has list and one detail column with intake before payment and conversation', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await fixture(page);
  await expect(page.getByText('창가 자리', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '복사', exact: true })).toBeVisible();
  await expect(page.getByText('결제 완료 · ₩4,500 · 카드')).toBeVisible();
  await expect(page.getByRole('button', { name: '환불 처리', exact: true })).toBeHidden();
  await page.screenshot({ path: '.tmp/phone-validation/desktop.png', fullPage: true });
});

for (const view of ['', 'support', 'phone', 'monitor']) test(`explicit view ${view || 'default'} opens its own workspace`, async ({ page }) => {
  await fixture(page);
  await page.goto(`http://phone.test/admin/dashboard?tab=CHATS${view ? `&view=${view}` : ''}`);
  const label = view === 'phone' ? '전화예약' : view === 'monitor' ? '실시간 모니터링' : '1:1 문의';
  await expect(page.getByRole('navigation', { name: 'Customer Support' }).getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-current', 'page');
  if (view !== 'phone') await expect(page.getByTestId('admin-chat-inquiry-row-' + (view === 'monitor' ? '456' : '789'))).toBeVisible();
});
