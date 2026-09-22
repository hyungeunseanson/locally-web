import { expect, test, type Page } from '@playwright/test';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { resolve } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { buildProxyInquiryInitialMessage } from '@/app/utils/proxyBooking';

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

async function fixture(page: Page, options: { failSend?: boolean; failComplete?: boolean; unpaid?: boolean; status?: string; inquiryId?: string; visual?: boolean } = {}) {
  const request = {
    id: 'request-1', user_id: 'guest', category: 'RESTAURANT', status: options.status || 'PENDING',
    payment_status: options.unpaid ? 'WAITING' : 'COMPLETED', payment_channel: 'LOCALLY',
    form_data: { payment_method: options.unpaid ? 'bank' as const : 'card' as const, restaurant_name: '스시 테스트', restaurant_phone: '0312345678', google_map_url: 'https://example.com/map', preferred_slot_primary: '2026-09-25T19:00', guest_number: 2, reservation_name: '홍길동', linked_inquiry_id: '123', request_notes: '창가 자리' },
    profiles: { full_name: '홍길동' }, linked_inquiry_id: '123', needs_attention: false, needs_reply: false,
    latest_sender_id: 'guest', latest_content: '예약해주세요', created_at: '2026-09-22T00:00:00Z',
  };
  if (options.visual) Object.assign(request, {
    category: 'HOTEL', profiles: { full_name: '테스트 고객' },
    form_data: { payment_method: 'card', property_name: '호텔 라이브맥스 버짓 닛포리 (Hotel Livemax BUDGET Nippori)', property_phone: '03-3823-1313', property_link: 'https://maps.app.goo.gl/fCPWn7ZoYQdZ4ode7?g_st=ac', reservation_number: 'TEST-12345678', checkin_date: '2026-09-25', checkout_date: '2026-09-28', hotel_inquiry_type: 'RESERVATION_CHECK', request_content: '늦은 체크인이 가능한지 확인해주세요.', contact_name: '테스트 고객', contact_phone: '010-0000-0000', additional_notes: '현장 확인 후 안내 부탁드립니다.', linked_inquiry_id: '123' },
  });
  const messages = [{ id: 1, sender_id: 'guest', content: '예약해주세요', type: 'text', sender: { name: '홍길동' } }];
  if (options.visual) messages[0].content = buildProxyInquiryInitialMessage({category: 'HOTEL', formData: request.form_data, paymentChannel: 'LOCALLY', finalAmount: 6000});
  if (options.visual) messages.push(
    { id: 2, sender_id: 'admin', content: '숙소에 늦은 체크인 가능 여부를 확인하고 안내드리겠습니다.', type: 'text', sender: { name: '운영팀' } },
    { id: 3, sender_id: 'guest', content: '감사합니다. 밤 10시쯤 도착할 예정입니다.', type: 'text', sender: { name: '테스트 고객' } },
  );
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
      return json({ success: true, data: url.searchParams.has('requestId') ? request : matching ? (options.visual ? Array.from({length:10},(_,i)=>({...request,id:i ? `request-${i+1}` : request.id, latest_content:'업체 확인 후 안내드리겠습니다.'})) : [request]) : [], pagination: { hasMore: false } });
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
    return route.fulfill({ contentType: 'text/html', body: `<html><head><style>${css}${options.visual ? '@media(min-width:768px){html{font-size:20px}body>main{max-width:1785px;margin:40px auto}}' : ''}</style></head><body><main style="padding:16px"><div id="root"></div></main><script>${script.replaceAll('</script', '<\\/script')}</script></body></html>` });
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

test('desktop polish reference at 2048x1231', async ({ page }) => {
  await page.setViewportSize({width:2048,height:1231});
  await fixture(page, {visual:true});
  await expect(page.getByText('늦은 체크인이 가능한지 확인해주세요.',{exact:true})).toBeVisible();
  await expect(page.getByTestId('admin-chat-messages-loading')).toHaveCount(0);
  const metrics = await page.evaluate(() => {
    const messages = document.querySelector('[data-testid="admin-chat-message-list"]')!;
    const detail = messages.parentElement!;
    const header = detail.firstElementChild!;
    const quick = messages.nextElementSibling!;
    const composer = quick.nextElementSibling!;
    const list = document.querySelector('[data-testid="admin-phone-reservation-list"]')!;
    const box = (el:Element) => Math.round(el.getBoundingClientRect().height);
    return {header:box(header),conversation:box(messages),quick:box(quick),composer:box(composer),row:box(list.querySelector('button')!),listHeader:box(list.previousElementSibling!),leftWidth:Math.round(list.getBoundingClientRect().width),rightWidth:Math.round(detail.getBoundingClientRect().width)};
  });
  mkdirSync('.tmp/phone-polish',{recursive:true});
  expect(metrics.header).toBeLessThanOrEqual(290);
  expect(metrics.conversation).toBeGreaterThanOrEqual(480);
  expect(metrics.quick).toBeLessThanOrEqual(46);
  expect(metrics.composer).toBeLessThanOrEqual(88);
  expect(metrics.row).toBeLessThanOrEqual(110);
  expect(metrics.listHeader).toBeLessThanOrEqual(155);
  expect(metrics.leftWidth / (metrics.leftWidth + metrics.rightWidth)).toBeCloseTo(0.3, 1);
  const link = page.getByRole('link', {name: '숙소 링크 열기'});
  await expect(link).toHaveAttribute('href', 'https://maps.app.goo.gl/fCPWn7ZoYQdZ4ode7?g_st=ac');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  const label = 'after';
  writeFileSync(`.tmp/phone-polish/${label}-metrics.json`,JSON.stringify(metrics,null,2));
  await page.screenshot({path:`.tmp/phone-polish/${label}-desktop.png`,fullPage:true});
});


test('mobile hotel intake and composer remain accessible without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page, { visual: true });
  await expect(page.getByTestId('admin-chat-messages-loading')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  for (const name of ['답변 보내기', '안내 보내고 완료']) {
    const box = await page.getByRole('button', { name, exact: true }).boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  }
  const disclosure = page.getByText('신청서 전체 보기', { exact: false });
  await expect(disclosure).toHaveCount(1);
  {
    await disclosure.focus();
    await page.keyboard.press('Enter');
    await expect(disclosure.locator('..')).toHaveAttribute('open', '');
  }
  await page.screenshot({ path: '.tmp/phone-polish/after-mobile.png', fullPage: true });
});
