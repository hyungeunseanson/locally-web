import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from '@playwright/test';

const require = createRequire(import.meta.url);
const unavailable = '사진 첨부 기능은 현재 준비 중입니다.';
const oldImage = {
  id: 10, inquiry_id: 1, sender_id: 'host', content: '', type: 'image',
  image_url: 'https://legacy.invalid/storage/v1/object/public/chat-images/1/old.jpg',
  created_at: '2026-09-01T00:00:00Z', sender: { id: 'host', name: 'Host', avatar_url: null },
};
const inquiry = {
  id: 1, user_id: 'guest', host_id: 'host', type: 'general', content: '기존 대화',
  guest: { id: 'guest', name: 'Guest', avatar_url: null },
  host: { id: 'host', name: 'Host', avatar_url: null },
  experiences: { id: 1, title: 'Experience', image_url: null },
};
const noNetwork = () => { throw new Error('Unexpected network/side effect in offline test'); };

// Execute complete application modules with explicit boundary fakes. Unknown
// dependencies fail closed so these tests cannot pick up Production credentials.
function loadModule(entry, mocks = {}, fetch = noNetwork) {
  const cache = new Map();
  function load(path) {
    const filename = resolve(path);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const localRequire = (id) => {
      if (id in mocks) return mocks[id];
      if (['react', 'react/jsx-runtime', 'lucide-react'].includes(id)) return require(id);
      if (['@/app/utils/chatAttachmentPolicy', '@/app/utils/inquiry', '@/app/utils/chatPolicySignals', '@/app/utils/officialSender'].includes(id)) {
        return load(id.replace('@/', '') + '.ts');
      }
      throw new Error(`Unmocked module: ${id}`);
    };
    new Function('require', 'module', 'exports', 'fetch', source)(localRequire, loadedModule, loadedModule.exports, fetch);
    return loadedModule.exports;
  }
  return load(entry);
}

function fakeDatabase(thread = inquiry) {
  const writes = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'guest' } } }) },
    storage: { from: noNetwork },
    from(table) {
      let operation = 'select';
      let values;
      const result = () => ({ error: null, data:
        table === 'inquiries' ? { ...thread, ...values, updated_at: '2026-09-12T00:00:00Z' } :
        table === 'inquiry_messages' ? (operation === 'insert' ? { id: 11, created_at: '2026-09-12T00:00:00Z' } : [oldImage]) :
        table === 'proxy_requests' ? { id: 'proxy-1', user_id: 'guest', form_data: {} } :
        table === 'public_profiles' || table === 'host_applications' ? [] : null });
      const query = {
        select: () => query, eq: () => query, in: () => query, order: () => query,
        limit: () => query, is: () => query, neq: () => query,
        insert(value) { operation = 'insert'; values = value; writes.push({ table, operation, value }); return query; },
        update(value) { operation = 'update'; values = value; writes.push({ table, operation, value }); return query; },
        maybeSingle: async () => result(),
        then: (resolvePromise) => resolvePromise(result()),
      };
      return query;
    },
  };
  return { client, writes };
}

function serverModules(thread = inquiry) {
  const db = fakeDatabase(thread);
  let adminCalls = 0;
  const mocks = {
    'next/server': { after: () => {}, NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/app/utils/supabase/admin': { createAdminClient: () => { adminCalls++; return db.client; }, recordAuditLog: async () => {} },
    '@/app/utils/supabase/server': { createClient: async () => db.client },
    '@/app/utils/sanitize': { sanitizeText: (text) => text, sanitizeUrl: (url) => url },
    '@/app/utils/emailCopy': { buildLocalizedEmailCopy: async () => ({ message: 'text' }) },
    '@/app/utils/notificationCopy': { buildNotificationCopy: () => ({ title: 'text', message: 'text' }) },
    '@/app/utils/notificationLocale': { resolveRecipientLocale: async () => 'ko' },
    '@/app/utils/adminSupportUnreadAlerts': { startOrAdvanceAdminSupportUnreadBatch: async () => {} },
    '@/app/utils/adminAlertCenter': { insertAdminAlerts: async () => {}, sendAdminAlertEmails: async () => {} },
    '@/app/utils/adminAccess': { resolveAdminAccess: async () => ({ isAdmin: false }) },
    '@/app/emails/delivery/sendTemplatedEmail': { sendTemplatedEmail: noNetwork },
    '@/app/utils/proxyBooking': { getProxyLinkedInquiryId: () => 1 },
  };
  const shared = loadModule('app/api/inquiries/thread/shared.ts', mocks);
  mocks['../thread/shared'] = shared;
  mocks['./shared'] = shared;
  mocks['@/app/api/inquiries/thread/shared'] = shared;
  return { db, shared, adminCalls: () => adminCalls, route: (path) => loadModule(path, mocks) };
}

const imagePayloads = [
  { imageUrl: 'https://legacy.invalid/photo.jpg' },
  { image_url: 'https://legacy.invalid/photo.jpg' },
  { image_url: '' }, { imageUrl: {} },
  { imageAttachmentId: 'a' }, { image_attachment_id: 'a' },
  { attachmentId: 'a' }, { attachment_id: 'a' },
  { attachment: { type: 'image', id: 'a' } }, { attachments: [{ type: 'image', id: 'a' }] },
  { image: {} }, { images: ['photo'] }, { file: {} }, { files: [] },
  { type: 'image' }, { type: ' IMAGE ' },
];

test('message API and first-thread writer reject all attachment aliases before DB access', async () => {
  for (const payload of imagePayloads) {
    const server = serverModules();
    const api = server.route('app/api/inquiries/message/route.ts');
    for (const content of ['', '사진과 텍스트']) {
      const response = await api.POST(new Request('http://offline.invalid/api/inquiries/message', {
        method: 'POST', body: JSON.stringify({ inquiryId: 1, content, ...payload }),
      }));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ success: false, error: unavailable });
    }
    await expect(server.shared.upsertInquiryThread({
      actor: { id: 'guest' }, body: { contextType: 'admin_support', message: 'text', ...payload },
    })).rejects.toMatchObject({ status: 400, message: unavailable });
    expect(server.adminCalls()).toBe(0);
    expect(server.db.writes).toEqual([]);
  }
});

test('proxy comment adapter rejects attachment payloads instead of silently saving text', async () => {
  for (const payload of imagePayloads) {
    const server = serverModules();
    const api = server.route('app/api/proxy-bookings/[id]/comments/route.ts');
    const response = await api.POST(new Request('http://offline.invalid/comments', {
      method: 'POST', body: JSON.stringify({ content: 'text', ...payload }),
    }), { params: Promise.resolve({ id: 'proxy-1' }) });
    expect(response.status).toBe(400);
    expect(server.db.writes).toEqual([]);
  }
});

test('guest, host and customer support text messages still persist with no image', async () => {
  for (const [actorId, type] of [['guest', 'general'], ['host', 'general'], ['guest', 'admin_support'], ['host', 'admin_support']]) {
    const server = serverModules({ ...inquiry, type });
    const result = await server.shared.createInquiryMessage({
      actor: { id: actorId }, body: { inquiryId: 1, content: '일반 텍스트\n둘째 줄', imageUrl: null, type: 'text' },
    });
    expect(result.success).toBe(true);
    expect(server.db.writes.find((write) => write.table === 'inquiry_messages')?.value).toMatchObject({
      content: '일반 텍스트\n둘째 줄', type: 'text', image_url: null, sender_id: actorId,
    });
  }
});

function hookHarness() {
  const state = [];
  const toasts = [];
  const requests = [];
  let cursor = 0;
  const db = fakeDatabase();
  const fakeReact = {
    ...React,
    useState(initial) {
      const index = cursor++;
      state[index] = index === 3 ? { id: 'guest' } : typeof initial === 'function' ? initial() : initial;
      return [state[index], (value) => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    },
    useEffect: () => {}, useMemo: (fn) => fn(), useCallback: (fn) => fn,
    useRef: (current) => ({ current }),
  };
  const { useChat } = loadModule('app/hooks/useChat.ts', {
    react: fakeReact,
    '@/app/utils/supabase/client': { createClient: () => db.client },
    '@/app/context/ToastContext': { useToast: () => ({ showToast: (message) => toasts.push(message), showHeicUnsupportedToast: noNetwork }) },
    '@/app/context/NotificationContext': { useNotification: () => ({ notifications: [] }) },
    '@/app/utils/sanitize': { sanitizeText: (text) => text },
    '@/app/utils/image': { compressImage: noNetwork, validateImage: noNetwork, sanitizeFileName: noNetwork },
    '@/app/utils/profile': { getHostPublicProfile: () => ({ name: 'Host', avatarUrl: null }) },
  }, async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    return Response.json({ success: true, messageId: 11, displayContent: 'text', updatedAt: '2026-09-12T00:00:00Z' });
  });
  // Isolated hook runtime: fake React owns state/effects; no component is mounted.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return { hook: useChat(), state, toasts, requests };
}

test('direct File arguments stop before validation, compression, Storage and message fetch', async () => {
  const { hook, toasts, requests } = hookHarness();
  for (const content of ['', 'text']) {
    await hook.sendMessage(1, content, new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }));
  }
  expect(toasts).toEqual([unavailable, unavailable]);
  expect(requests).toEqual([]);
});

test('hook still sends text and parses existing image_url rows', async () => {
  const { hook, requests, state } = hookHarness();
  await hook.sendMessage(1, '안녕하세요', undefined, 'guest');
  expect(requests[0]).toMatchObject({ url: '/api/inquiries/message', body: { content: '안녕하세요', type: 'text', imageUrl: null } });
  await hook.loadMessages(1);
  expect(state[2][0]).toMatchObject({ image_url: oldImage.image_url, type: 'image', content: '📷 사진을 보냈습니다.' });
});

for (const surface of ['guest', 'host', 'support']) {
  test(`${surface} browser rendering hides attachment controls and keeps old images/text`, async ({ page }) => {
    const selectedInquiry = { ...inquiry, type: surface === 'support' ? 'admin_support' : 'general' };
    const chat = {
      inquiries: [selectedInquiry], selectedInquiry, isLoading: false,
      currentUser: { id: surface === 'host' ? 'host' : 'guest' },
      messages: [oldImage, { ...oldImage, id: 12, type: 'text', content: '기존 텍스트', image_url: null }],
    };
    const blank = () => null;
    const mocks = {
      '@/app/hooks/useChat': { useChat: () => chat },
      'next/navigation': { useRouter: () => ({}), useSearchParams: () => new URLSearchParams(), usePathname: () => '/host/dashboard' },
      'next/link': ({ children, href }) => React.createElement('a', { href }, children),
      'next/image': ({ src, alt, width, height }) => React.createElement('img', { src, alt, width, height }),
      '@/app/components/SiteHeader': blank,
      '@/app/components/ui/Spinner': blank,
      '@/app/components/UserProfileModal': blank,
      '@/app/context/LanguageContext': { useLanguage: () => ({ t: (key) => key, lang: 'ko' }) },
      '@/app/utils/supabase/client': { createClient: () => ({}) },
      '@/app/utils/profile': { getHostPublicProfile: () => ({ name: 'Host', avatarUrl: null }) },
      '@/app/hooks/useAutoResizeTextarea': { useAutoResizeTextarea: () => null },
      '@/app/components/proxy/ProxyBankTransferNotice': { ProxyBankTransferNotice: blank },
      '@/app/components/chat/ChatSafetyNotice': blank,
    };
    const entry = surface === 'host' ? 'app/host/dashboard/InquiryChat.tsx' : 'app/guest/inbox/page.tsx';
    const Component = loadModule(entry, mocks).default;
    await page.route('**/*', (route) => route.abort());
    await page.setContent(renderToStaticMarkup(React.createElement(Component)));
    await expect(page.locator('input[type="file"], svg.lucide-image-plus')).toHaveCount(0);
    await expect(page.getByText('기존 텍스트', { exact: true })).toBeVisible();
    await expect(page.locator('img[alt="chat-img"]')).toHaveAttribute('src', oldImage.image_url);
    await expect(page.locator(`a[href="${oldImage.image_url}"]`)).toHaveCount(1);
    await expect(page.locator('textarea')).toBeEnabled();
  });
}

test('Storage OFF SQL stays a do-not-rerun historical record of the single audited policy drop', () => {
  const sql = readFileSync('docs/ops/chat-attachments/disable-chat-image-inserts.sql', 'utf8');
  expect(sql).toContain('Applied to Production on 2026-09-12; do not rerun');
  expect(sql.match(/^DROP POLICY.*$/gm)).toEqual(['DROP POLICY "Authenticated users can upload chat images" ON storage.objects;']);
  expect(sql).not.toMatch(/\b(?:DELETE FROM|UPDATE storage|ALTER TABLE|ALTER POLICY|CREATE POLICY|TRUNCATE|REVOKE)\b/i);
  expect(sql).toContain("cmd IN ('INSERT', 'ALL')");
  expect(existsSync('supabase/migrations/disable-chat-image-inserts.sql')).toBe(false);
  const policy = loadModule('app/utils/chatAttachmentPolicy.ts');
  expect(policy.CHAT_IMAGE_ATTACHMENTS_ENABLED).toBe(false);
  expect(readFileSync('app/utils/chatAttachmentPolicy.ts', 'utf8')).not.toContain('process.env');
});
