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

async function fixture(page: Page, options: { paymentMetadata?: boolean; lastAdmin?: boolean; paymentStatus?: string; missingLink?: boolean; failSend?: boolean; failComplete?: boolean; unpaid?: boolean; status?: string; inquiryId?: string; visual?: boolean; channel?: string; method?: string } = {}) {
  const request = {
    id: 'request-1', user_id: 'guest', category: 'RESTAURANT', status: options.status || 'PENDING',
    payment_status: options.paymentStatus || (options.unpaid ? 'WAITING' : 'COMPLETED'), payment_channel: options.channel || 'LOCALLY',
    form_data: { payment_method: (options.method || (options.unpaid ? 'bank' : 'card')) as 'bank' | 'card', restaurant_name: '스시 테스트', restaurant_phone: '0312345678', google_map_url: 'https://example.com/map', preferred_slot_primary: '2026-09-25T19:00', guest_number: 2, reservation_name: '홍길동', linked_inquiry_id: '123', request_notes: '창가 자리' },
    profiles: { full_name: '홍길동' }, linked_inquiry_id: options.missingLink ? null : '123', needs_attention: false, needs_reply: false,
    latest_sender_id: 'guest', latest_content: '예약해주세요', created_at: '2026-09-22T00:00:00Z', updated_at: '2026-09-22T10:00:00Z',
  };
  if (options.visual) Object.assign(request, {
    category: 'HOTEL', profiles: { full_name: '테스트 고객' },
    form_data: { payment_method: 'card', property_name: '호텔 라이브맥스 버짓 닛포리 (Hotel Livemax BUDGET Nippori)', property_phone: '03-3823-1313', property_link: 'https://maps.app.goo.gl/fCPWn7ZoYQdZ4ode7?g_st=ac', reservation_number: 'TEST-12345678', checkin_date: '2026-09-25', checkout_date: '2026-09-28', hotel_inquiry_type: 'RESERVATION_CHECK', request_content: '늦은 체크인이 가능한지 확인해주세요.', contact_name: '테스트 고객', contact_phone: '010-0000-0000', additional_notes: '현장 확인 후 안내 부탁드립니다.', linked_inquiry_id: '123' },
  });
  request.needs_attention = !request.linked_inquiry_id || (['PENDING', 'IN_PROGRESS'].includes(request.status) && ['REFUNDED', 'FAILED'].includes(request.payment_status));
  const messages = [{ id: 1, sender_id: 'guest', content: '예약해주세요', type: 'text', created_at: '2026-09-22T10:05:00Z', sender: { name: '홍길동' } }];
  if (options.visual) messages[0].content = buildProxyInquiryInitialMessage({category: 'HOTEL', formData: request.form_data, paymentChannel: 'LOCALLY', finalAmount: 6000});
  if (options.visual) messages.push(
    { id: 2, sender_id: 'admin', content: '숙소에 늦은 체크인 가능 여부를 확인하고 안내드리겠습니다.', type: 'text', created_at: '2026-09-22T10:05:00Z', sender: { name: '운영팀' } },
    { id: 3, sender_id: 'guest', content: '감사합니다. 밤 10시쯤 도착할 예정입니다.', type: 'text', created_at: '2026-09-22T10:05:00Z', sender: { name: '테스트 고객' } },
  );
  if (options.lastAdmin) messages.push({ id: 4, sender_id: 'admin', content: '환불 안내', type: 'text', created_at: '2026-09-22T10:05:00Z', sender: { name: '운영팀' } });
  if (options.paymentMetadata) Object.assign(request, { locally_order_id: 'ORDER-123', naver_buyer_name: '네이버 구매자', tid: 'CARD-TRANSACTION-123', paid_at: '2026-09-22T01:00:00Z', refunded_at: '2026-09-22T02:00:00Z' });
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
      request.needs_reply = latest.sender_id === 'guest' && (request.status === 'COMPLETED' || request.status === 'CANCELLED' && Date.parse(latest.created_at) > Date.parse(request.updated_at));
      const filter = url.searchParams.get('filter');
      const matching = filter === 'all' || filter === 'closed' && ['COMPLETED', 'CANCELLED'].includes(request.status) && !request.needs_reply && !request.needs_attention
        || filter === 'todo' && (request.needs_attention || request.needs_reply || ['PENDING', 'IN_PROGRESS'].includes(request.status) && request.payment_status === 'COMPLETED')
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
      messages.push({ id: messages.length + 1, sender_id: 'admin', content: body.content, type: 'text', created_at: '2026-09-22T10:05:00Z', sender: { name: '관리자' } });
      return json({ success: true, inquiryId: body.inquiryId, messageId: messages.length, displayContent: body.content, updatedAt: new Date().toISOString() });
    }
    if (path === '/api/proxy-bookings/request-1') {
      calls.push({ path, body: route.request().postDataJSON() });
      if (failComplete || request.payment_status !== 'COMPLETED') { failComplete = false; return json({ success: false, error: '완료 처리 실패' }, 409); }
      request.status = 'COMPLETED'; return json({ success: true });
    }
    if (path === '/api/admin/proxy-bookings/refund-payment') {
      calls.push({ path, body: route.request().postDataJSON() });
      request.payment_status = 'REFUNDED';
      if (['PENDING', 'IN_PROGRESS'].includes(request.status)) { request.status = 'CANCELLED'; request.updated_at = '2026-09-22T10:10:00Z'; }
      return json({ success: true });
    }
    if (path.startsWith('/api/')) {
      if (route.request().method() !== 'GET') calls.push({path, body:route.request().postDataJSON()});
      return json({ success: true });
    }
    return route.fulfill({ contentType: 'text/html', body: `<html><head><style>${css}${options.visual ? '@media(min-width:768px){html{font-size:20px}body>main{max-width:1785px;margin:40px auto}}' : ''}</style></head><body><main style="padding:16px"><div id="root"></div></main><script>${script.replaceAll('</script', '<\\/script')}</script></body></html>` });
  });
  await page.goto(`http://phone.test/admin/dashboard?tab=CHATS&${options.inquiryId ? `inquiryId=${options.inquiryId}` : 'view=phone&proxyRequestId=request-1'}`);
  return { calls, request, messages };
}

const composer = (page: Page) => page.getByTestId('admin-chat-composer').filter({ visible: true });
const send = (page: Page) => page.getByRole('button', { name: '메시지 전송', exact: true }).filter({ visible: true });
const menu = (page: Page) => page.getByLabel('전화예약 업무 메뉴');
async function complete(page: Page) {
  await menu(page).click();
  await page.getByRole('button', { name: '처리 완료', exact: true }).click();
  await page.getByRole('button', { name: '완료 처리', exact: true }).click();
}

for (const status of ['PENDING', 'IN_PROGRESS']) test(`paid ${status}: reply and completion are independent`, async ({ page }) => {
  const state = await fixture(page, { status });
  await composer(page).fill('고객에게 안내');
  await send(page).click();
  await expect(composer(page)).toHaveValue('');
  expect(state.request.status).toBe(status);
  expect(state.calls.map(call => call.path)).toEqual(['/api/inquiries/message']);
  await complete(page);
  await expect.poll(() => state.request.status).toBe('COMPLETED');
  expect(state.calls.map(call => call.path)).toEqual(['/api/inquiries/message', '/api/proxy-bookings/request-1']);
  expect(state.calls[1].body).toEqual({status:'COMPLETED'});
  await menu(page).click();
  await expect(page.getByRole('button', { name: '처리 완료', exact:true })).toHaveCount(0);
});

test('completion without sending preserves draft; failure can be retried independently', async ({ page }) => {
  const state = await fixture(page, { failComplete: true });
  await composer(page).fill('아직 보내지 않은 초안');
  await complete(page);
  await expect.poll(() => state.calls.length).toBe(1);
  expect(state.request.status).toBe('PENDING');
  await expect(page.getByRole('button',{name:'완료 처리',exact:true})).toHaveCount(0);
  await complete(page);
  await expect.poll(() => state.request.status).toBe('COMPLETED');
  expect(state.calls.map(call=>call.path)).toEqual(['/api/proxy-bookings/request-1','/api/proxy-bookings/request-1']);
  expect(state.messages).toHaveLength(1);
  await expect(composer(page)).toHaveValue('아직 보내지 않은 초안');
});

test('send failure leaves draft and request unchanged', async ({ page }) => {
  const state = await fixture(page, { failSend:true });
  await composer(page).fill('남아야 하는 답변');
  await send(page).click();
  await expect(composer(page)).toBeEnabled();
  await expect(composer(page)).toHaveValue('남아야 하는 답변');
  expect(state.request.status).toBe('PENDING');
  expect(state.calls.map(call=>call.path)).toEqual(['/api/inquiries/message']);
});

for (const channel of ['LOCALLY','NAVER']) test(`unpaid ${channel}: manual actions available, completion absent`, async ({ page }) => {
  const state = await fixture(page, { unpaid:true, channel });
  await menu(page).click();
  await expect(page.getByRole('button',{name:'처리 완료',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'결제 취소',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'입금 확인',exact:true}).click();
  expect(state.calls.map(call=>call.path)).toEqual(['/api/admin/proxy-bookings/confirm-payment']);
  await composer(page).fill('입금 확인 중입니다.');
  await send(page).click();
  await expect(composer(page)).toHaveValue('');
  expect(state.request.status).toBe('PENDING');
  expect(state.calls.map(call=>call.path)).toEqual(['/api/admin/proxy-bookings/confirm-payment','/api/inquiries/message']);
});

test('legacy waiting card has no manual payment or completion actions', async ({page}) => {
  await fixture(page,{unpaid:true,method:'card'});
  await expect(composer(page)).toBeVisible();
  await menu(page).click();
  await expect(page.getByRole('button', { name: '결제 상세', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '입금 확인', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '처리 완료', exact: true })).toHaveCount(0);
});

for (const action of ['cancel-payment','refund-payment']) test(`${action} stays behind confirmation and uses existing endpoint`, async ({page}) => {
  const state = await fixture(page,{unpaid:action==='cancel-payment',status:action==='refund-payment'?'COMPLETED':'PENDING'});
  await menu(page).click();
  await page.getByRole('button',{name:action==='refund-payment'?'환불 처리':'결제 취소',exact:true}).click();
  expect(state.calls).toHaveLength(0);
  await page.getByRole('button',{name:'확인',exact:true}).click();
  await expect.poll(()=>state.calls.length).toBe(1);
  expect(state.calls[0]).toEqual({path:`/api/admin/proxy-bookings/${action}`,body:{requestId:'request-1'}});
});

for (const status of ['COMPLETED', 'CANCELLED']) test(`${status} follow-up reply clears needs_reply without changing proxy or inquiry status`, async ({ page }) => {
  const state = await fixture(page, { status });
  await expect(page.getByTestId('admin-phone-reservation-list-item')).toContainText('추가 답장');
  await composer(page).fill('추가 답변');
  await send(page).click();
  await expect(page.getByTestId('admin-phone-reservation-list-item')).toHaveCount(0);
  expect(state.request.status).toBe(status);
  expect(state.calls.map(call=>call.path)).toEqual(['/api/inquiries/message']);
});

for (const [id, view] of [['123','phone'],['456','monitor'],['789','support']]) test(`legacy inquiry ${id} resolves to ${view}`, async ({page}) => {
  await fixture(page,{inquiryId:id});
  await expect(page).toHaveURL(new RegExp(`view=${view}`));
  if(view==='phone') await expect(page).toHaveURL(/proxyRequestId=request-1/);
});

for (const view of ['', 'support', 'phone', 'monitor']) test(`explicit view ${view || 'default'} opens its workspace`, async ({ page }) => {
  await fixture(page);
  await page.goto(`http://phone.test/admin/dashboard?tab=CHATS${view ? `&view=${view}` : ''}`);
  const label = view === 'phone' ? '전화예약' : view === 'monitor' ? '실시간 모니터링' : '1:1 문의';
  await expect(page.getByRole('navigation', { name: 'Customer Support' }).getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-current', 'page');
  if (view !== 'phone') await expect(page.getByTestId('admin-chat-inquiry-row-' + (view === 'monitor' ? '456' : '789'))).toBeVisible();
});

test('mobile back preserves draft, filter and search', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  const state = await fixture(page);
  await composer(page).fill('작성 중인 답변');
  await page.getByRole('button',{name:'목록으로',exact:true}).click();
  await page.getByRole('button',{name:'전체',exact:true}).click();
  await page.getByRole('textbox',{name:'전화예약 검색'}).fill('홍길동');
  await page.getByTestId('admin-phone-reservation-list-item').click();
  await expect(composer(page)).toHaveValue('작성 중인 답변');
  await page.getByRole('button',{name:'목록으로',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'전화예약 검색'})).toHaveValue('홍길동');
  await expect(page.getByRole('button',{name:'전체',exact:true})).toHaveAttribute('aria-pressed','true');
  expect(state.calls).toHaveLength(0);
});

for (const width of [390,2048]) test(`normal chat layout and composer parity at ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:width===390?844:1231});
  const state = await fixture(page,{visual:true});
  await expect(composer(page)).toBeVisible();
  const messages = page.getByTestId('admin-chat-message-list').filter({visible:true});
  await expect(messages).toContainText(state.messages[0].content);
  for(const label of ['예약 확정','예약 불가','확인 결과','안내 보내고 완료','답변 보내기','신청서 전체 보기']) {
    await expect(page.getByRole('button',{name:label,exact:true})).toHaveCount(0);
  }
  await expect(page.getByTestId('admin-phone-intake-header')).toHaveCount(0);
  await expect(page.getByTestId('admin-phone-quick-replies')).toHaveCount(0);
  const metrics = await messages.evaluate(el=>({conversation:el.getBoundingClientRect().height,detail:el.parentElement!.getBoundingClientRect().height,header:el.previousElementSibling!.getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth}));
  expect(metrics.overflow).toBe(false);
  expect(metrics.conversation / metrics.detail).toBeGreaterThan(0.65);
  expect(metrics.header).toBeLessThan(width===390?85:110);
  const style = await composer(page).evaluate(el=>({height:el.getBoundingClientRect().height,font:getComputedStyle(el).fontSize,padding:getComputedStyle(el).padding}));
  const box = await send(page).boundingBox();
  expect(box!.x+box!.width).toBeLessThanOrEqual(width);
  expect(box!.y+box!.height).toBeLessThanOrEqual(width===390?844:1231);
  if(width===2048) {
    const list = await page.getByTestId('admin-phone-reservation-list').boundingBox();
    const detail = await messages.boundingBox();
    expect(list!.x+list!.width).toBeLessThan(detail!.x);
    expect(list!.width/(list!.width+detail!.width)).toBeCloseTo(0.3,1);
  }
  mkdirSync('.tmp/phone-unification',{recursive:true});
  writeFileSync(`.tmp/phone-unification/${width}-metrics.json`,JSON.stringify({metrics,composer:style},null,2));
  await page.screenshot({path:`.tmp/phone-unification/${width}.png`,fullPage:true});
  await page.goto('http://phone.test/admin/dashboard?tab=CHATS&view=support&inquiryId=789');
  await expect(composer(page)).toBeVisible();
  const normal = await composer(page).evaluate(el=>({height:el.getBoundingClientRect().height,font:getComputedStyle(el).fontSize,padding:getComputedStyle(el).padding}));
  expect(style).toEqual(normal);
});

for (const view of ['support', 'monitor']) test(`${view} retains its existing send and inquiry-status behavior`, async ({page}) => {
  const state = await fixture(page);
  const id = view === 'support' ? '789' : '456';
  await page.goto(`http://phone.test/admin/dashboard?tab=CHATS&view=${view}&inquiryId=${id}`);
  await composer(page).fill('기존 채팅 답변');
  await send(page).click();
  await expect(composer(page)).toHaveValue('');
  await expect.poll(()=>state.calls.length).toBe(view==='support'?2:1);
  expect(state.calls.map(call=>call.path)).toEqual(view==='support'?['/api/inquiries/message','/api/admin/inquiries/789/status']:['/api/inquiries/message']);
  if(view==='support') expect(state.calls[1].body.status).toBe('in_progress');
  expect(state.request.status).toBe('PENDING');
});

for (const scenario of [
  { paymentStatus: 'REFUNDED', label: '환불 후 예약 상태 확인' },
  { paymentStatus: 'FAILED', label: '결제 취소 후 예약 상태 확인' },
  { paymentStatus: 'COMPLETED', missingLink: true, label: '문의 연결 확인 필요' },
  { paymentStatus: 'REFUNDED', missingLink: true, label: '문의 연결 확인 필요' },
]) test(`390px attention stays compact in detail and todo list: ${scenario.paymentStatus}/${Boolean(scenario.missingLink)}`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await fixture(page, { ...scenario, visual: true });
  const header = page.getByTestId('admin-phone-chat-header');
  await expect(header.getByText(scenario.label, { exact: true })).toBeVisible();
  await expect(page.getByText('확인 필요', { exact: true })).toHaveCount(0);
  const metrics = await header.evaluate(el => ({ height: el.getBoundingClientRect().height, overflow: document.documentElement.scrollWidth > innerWidth }));
  expect(metrics.height).toBeLessThan(85);
  expect(metrics.overflow).toBe(false);
  mkdirSync('.tmp/phone-attention', { recursive: true });
  const name = `${scenario.paymentStatus}-${Boolean(scenario.missingLink)}`;
  writeFileSync(`.tmp/phone-attention/${name}.json`, JSON.stringify(metrics));
  await page.screenshot({ path: `.tmp/phone-attention/${name}.png`, fullPage: true });
  await page.getByRole('button', { name: '목록으로', exact: true }).click();
  await expect(page.getByRole('button', { name: '처리할 일', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('admin-phone-reservation-list-item').first().getByText(scenario.label, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(state.calls).toHaveLength(0);
  expect(state.request.status).toBe('PENDING');
  expect(state.request.payment_status).toBe(scenario.paymentStatus);
});

for (const paymentStatus of ['WAITING', 'COMPLETED', 'FAILED', 'REFUNDED']) test(`read-only payment details at 390px: ${paymentStatus}`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await fixture(page, { paymentStatus, status: paymentStatus === 'REFUNDED' || paymentStatus === 'FAILED' ? 'CANCELLED' : 'PENDING', paymentMetadata: true, channel: paymentStatus === 'WAITING' ? 'NAVER' : 'LOCALLY' });
  await menu(page).click();
  await page.getByRole('button', { name: '결제 상세', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '결제 상세' });
  await expect(dialog).toBeVisible();
  for (const text of ['ORDER-123', 'CARD-TRANSACTION-123', '네이버 구매자', '2026. 9. 22. 10:00', '2026. 9. 22. 11:00', '한국 시간', '₩']) await expect(dialog).toContainText(text);
  await expect(dialog).toContainText(paymentStatus === 'WAITING' ? '네이버 주문' : '카드');
  await expect(dialog.getByRole('button')).toHaveCount(1);
  if (paymentStatus === 'REFUNDED') {
    mkdirSync('.tmp/phone-payment', { recursive: true });
    await page.screenshot({ path: '.tmp/phone-payment/mobile.png', fullPage: true });
  }
  expect(await dialog.evaluate(el => el.scrollWidth > el.clientWidth || document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(menu(page)).toBeFocused();
  await menu(page).click();
  await page.getByRole('button', { name: '결제 상세', exact: true }).click();
  await page.getByRole('button', { name: '결제 상세 닫기' }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.calls).toHaveLength(0);
});

test('missing payment metadata uses placeholders; refunded request stays closed without a customer reply', async ({ page }) => {
  const state = await fixture(page, { paymentStatus: 'REFUNDED', status: 'CANCELLED', lastAdmin: true });
  await menu(page).click();
  await page.getByRole('button', { name: '결제 상세', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('dd').filter({ hasText: /^—$/ })).toHaveCount(5);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '종료', exact: true }).click();
  await expect(page.getByTestId('admin-phone-reservation-list-item')).toBeVisible();
  await expect(page.getByText('환불 후 예약 상태 확인', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '처리할 일', exact: true }).click();
  await expect(page.getByTestId('admin-phone-reservation-list-item')).toHaveCount(0);
  expect(state.calls).toHaveLength(0);
});

for (const status of ['PENDING', 'IN_PROGRESS']) test(`refund refresh closes ${status} without sending a message`, async ({ page }) => {
  const state = await fixture(page, { status, lastAdmin: true });
  await menu(page).click();
  await page.getByRole('button', { name: '환불 처리', exact: true }).click();
  await page.getByRole('button', { name: '확인', exact: true }).click();
  const header = page.getByTestId('admin-phone-chat-header');
  await expect(header).toContainText('취소');
  await expect(header).toContainText('환불 완료');
  await expect(header).not.toContainText('환불 후 예약 상태 확인');
  await expect(page.getByTestId('admin-phone-reservation-list-item')).toHaveCount(0);
  await page.getByRole('button', { name: '종료', exact: true }).click();
  await expect(page.getByTestId('admin-phone-reservation-list-item')).toBeVisible();
  expect(state.calls.map(call => call.path)).toEqual(['/api/admin/proxy-bookings/refund-payment']);
});
