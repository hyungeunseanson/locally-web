import { expect, test } from '@playwright/test';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { resolve } from 'node:path';

let script: string;
let css: string;
test.beforeAll(async () => {
  const bundle = await build({
    stdin: { contents: "import React from 'react'; import {createRoot} from 'react-dom/client'; import ChatMonitor from './app/admin/dashboard/components/ChatMonitor'; createRoot(document.getElementById('root')).render(<ChatMonitor/>);", loader: 'tsx', resolveDir: process.cwd() },
    bundle: true, write: false, format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"test"' },
    plugins: [{ name: 'local-admin-boundaries', setup(builder) {
      builder.onResolve({ filter: /^(next\/navigation|next\/image|@\/app\/utils\/supabase\/client|@\/app\/context\/ToastContext)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => {
        let contents = '';
        if (args.path === 'next/navigation') contents = "const router={push(){},replace(){}}; const params=new URLSearchParams(); export const useRouter=()=>router; export const usePathname=()=>'/admin/dashboard'; export const useSearchParams=()=>params;";
        else if (args.path === 'next/image') contents = "import React from 'react'; export default function Image({unoptimized,...props}) {return React.createElement('img',props)}";
        else if (args.path.includes('ToastContext')) contents = "const showToast=()=>{}; export const useToast=()=>({showToast});";
        else contents = "const client={auth:{getUser:async()=>({data:{user:{id:'admin'}}})},channel:()=>{const c={on:()=>c,subscribe:()=>c};return c},removeChannel:()=>{}};export const createClient=()=>client;";
        return { contents, loader: 'js', resolveDir: process.cwd() };
      });
    } }],
  });
  script = bundle.outputFiles[0].text;
  css = (await postcss([tailwind()]).process('@import "tailwindcss";', { from: resolve('app/admin-chat-phase1-fixture.css') })).css;
});

for (const width of [390, 1280]) {
  test(`admin metadata and KST dates remain readable at ${width}px with an overseas browser timezone`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const row = { id: 1, type: 'admin_support', user_id: 'guest', guest: { name: '테스트 고객' }, status: 'open', content: '완료 뒤에 다시 문의합니다',
      updated_at: '2026-10-02T06:42Z', last_message_at: '2026-10-02T06:42Z', last_sender_role: 'customer', needs_reply: true,
      reply_waiting_since: '2026-10-02T05:00Z', support_reopened_at: '2026-10-02T06:42Z' };
    const messages = [
      { id: 10, inquiry_id: 1, sender_id: 'guest', content: '이전 날짜 문의', type: 'text', created_at: '2026-10-01T14:59Z' },
      { id: 11, inquiry_id: 1, sender_id: 'admin', content: '확인했습니다', type: 'text', created_at: '2026-10-01T15:00Z' },
      { id: 12, inquiry_id: 1, sender_id: 'guest', content: '완료 뒤에 다시 문의합니다', type: 'text', created_at: '2026-10-02T06:42Z' },
      { id: 13, inquiry_id: 1, sender_id: 'guest', content: '시간이 없는 예전 기록', type: 'text', created_at: null },
    ];
    const calls: string[] = [];
    await page.route('**/*', route => {
      const url = new URL(route.request().url()); calls.push(url.pathname);
      if (url.hostname !== 'admin-chat.test') return route.abort();
      if (url.pathname === '/api/admin/inquiries') return route.fulfill({ json: { success: true, data: [row], pagination: { hasMore: false } } });
      if (url.pathname.endsWith('/messages')) return route.fulfill({ json: { success: true, inquiry: row, data: messages } });
      if (url.pathname.endsWith('/ack')) return route.fulfill({ json: { success: true } });
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: `<style>${css}</style><div id="root" style="height:800px"></div>` });
      return route.abort();
    });
    await page.goto('http://admin-chat.test/');
    // Fix only the display clock; fixture message times remain real supplied values.
    await page.evaluate(() => { Date.now = () => new Date('2026-10-02T06:45Z').getTime(); });
    await page.addScriptTag({ content: script });
    const activity = page.getByTestId('admin-chat-activity');
    await expect(activity).toContainText('마지막 발신: 고객');
    await expect(activity).toContainText('답변 필요 · 1시간 45분 대기');
    await expect(activity).toContainText('완료 후 재문의');
    await expect(page.getByTestId('admin-chat-inquiry-row-1')).toContainText('오늘 오후 3:42');
    await page.getByTestId('admin-chat-inquiry-row-1').click();
    await expect(page.getByTestId('admin-chat-date-separator')).toHaveText(['날짜 정보 없음', '어제', '오늘']);
    await expect(page.locator('time', { hasText: '오후 3:42' })).toBeVisible();
    await expect(page.locator('time', { hasText: '시간 정보 없음' })).toBeVisible();
    expect(calls).not.toContain('/api/inquiries/read');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  });
}
