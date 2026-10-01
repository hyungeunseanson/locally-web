import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { Script } from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
// Load actual source, with an explicit boundary around I/O and Next-only UI.
// Unknown imports fail closed; these tests never create a real Supabase client.
export function sourceLoader(stubs = {}) {
  const modules = new Map();
  function load(path) {
    const filename = resolve(path);
    if (modules.has(filename)) return modules.get(filename).exports;
    const loadedModule = { exports: {} };
    modules.set(filename, loadedModule);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
      fileName: filename,
    }).outputText;
    const localRequire = (name) => {
      if (Object.hasOwn(stubs, name)) return stubs[name];
      if (['react', 'react/jsx-runtime'].includes(name)) return require(name);
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? resolve(name.slice(2)) : resolve(dirname(filename), name);
        const target = [base, `${base}.ts`, `${base}.tsx`].find(existsSync);
        if (target) return load(target);
      }
      throw new Error(`Unmocked import: ${name} in ${filename}`);
    };
    new Script(`(function(require,module,exports){${code}\n})`, { filename }).runInThisContext()(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load;
}

export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

export function queryBuilder(table, execute) {
  const state = { table, filters: [], operation: 'select' };
  const builder = {};
  for (const method of ['select', 'order', 'limit', 'eq', 'neq', 'in', 'or', 'is', 'insert', 'update', 'delete', 'maybeSingle', 'single']) {
    builder[method] = (...args) => {
      if (method === 'select') state.columns = args[0];
      else if (['insert', 'update', 'delete'].includes(method)) { state.operation = method; state.body = args[0]; }
      else if (['eq', 'neq', 'in', 'or', 'is'].includes(method)) state.filters.push([method, ...args]);
      return builder;
    };
  }
  builder.then = (yes, no) => Promise.resolve().then(() => execute(state)).then(yes, no);
  return builder;
}

export const timestamp = '2026-10-01T00:00:00.000Z';
export const user = { id: 'guest', email: 'guest@example.invalid', user_metadata: { full_name: 'Guest' } };
export function inquiry(id, type = 'general') {
  return { id, user_id: 'guest', host_id: type === 'general' ? 'host' : null, experience_id: 1, type, status: 'open', content: 'preview', updated_at: timestamp, experiences: null };
}
export function message(id, inquiryId, sender = 'host', content = `body-${id}`) {
  return { id, inquiry_id: inquiryId, sender_id: sender, content, type: 'text', created_at: timestamp, is_read: false, read_at: null };
}
export function response(body, status = 200) { return { ok: status < 400, status, json: async () => body }; }

export function clientFixture({ role = 'guest', rows = [inquiry(1), inquiry(2), inquiry(3, 'admin_support')] } = {}) {
  const calls = { auth: 0, queries: [], requests: [], channels: [], removed: [] };
  const pendingTimers = new Map();
  const fixture = {
    calls, rows, role,
    auth: async () => ({ data: { user: role === 'host' ? { ...user, id: 'host' } : user } }),
    query: async (state) => {
      if (state.table === 'inquiries') return { data: fixture.rows };
      if (state.table === 'inquiry_messages') return { data: state.columns === 'inquiry_id' ? [] : [message(10, state.filters.find(([method, key]) => method === 'eq' && key === 'inquiry_id')?.[2] || 1)] };
      if (state.table === 'public_profiles') return { data: [{ id: 'guest', full_name: 'Guest', avatar_url: '/guest.png' }, { id: 'host', full_name: 'Host', avatar_url: '/host.png' }] };
      if (state.table === 'host_applications') return { data: [{ user_id: 'host', name: 'Public Host', profile_photo: '/application.png' }] };
      throw new Error(`Unexpected table ${state.table}`);
    },
    request: async (url) => {
      if (url === '/api/inquiries/read') return response({ success: true });
      if (url.startsWith('/api/proxy-bookings/inquiry/')) return response({ success: true, guidance: null });
      if (url.startsWith('/api/admin/inquiries?')) return response({ success: true, data: fixture.rows, hasMore: false });
      if (/\/api\/admin\/inquiries\/\d+\/messages/.test(url)) {
        const id = Number(url.split('/')[4]);
        return response({ success: true, data: [message(10, id, 'admin')], inquiry: fixture.rows.find((row) => row.id === id) });
      }
      if (url === '/api/inquiries/message') return response({ success: true, inquiryId: 1, messageId: 99, displayContent: 'sent', updatedAt: timestamp });
      throw new Error(`Unexpected request ${url}`);
    },
  };
  const client = {
    auth: { getUser: () => { calls.auth++; return fixture.auth(); } },
    from: (table) => queryBuilder(table, (state) => { calls.queries.push(state); return fixture.query(state); }),
    channel: (name) => {
      const channel = { name, handlers: [], on: (...args) => { channel.handlers.push(args); return channel; }, subscribe: (callback) => { channel.status = callback; return channel; } };
      calls.channels.push(channel); return channel;
    },
    removeChannel: (channel) => { calls.removed.push(channel); },
  };
  const router = { push() {}, replace() {}, back() {} };
  const searchParams = new URLSearchParams();
  const empty = () => null;
  const icons = new Proxy({}, { get: (_, name) => () => React.createElement('svg', { className: `lucide-${String(name).toLowerCase()}` }) });
  const toast = { showToast() {}, showHeicUnsupportedToast() {} };
  const stubs = {
    '@/app/utils/supabase/client': { createClient: () => client },
    '@/app/context/ToastContext': { useToast: () => toast },
    '@/app/context/NotificationContext': { useNotification: () => ({ notifications: [] }) },
    '@/app/utils/image': {},
    '@/app/utils/privateStorageDelivery': { getPrivateChatImageDeliveryUrl: (id) => `/api/inquiries/messages/${id}/image` },
    '@/app/context/LanguageContext': { useLanguage: () => ({ t: (key) => key, lang: 'ko' }) },
    'next/navigation': { useSearchParams: () => searchParams, useRouter: () => router, usePathname: () => '/host/dashboard' },
    'next/image': { default: (props) => { const imageProps = { ...props }; for (const key of ['unoptimized', 'fill', 'priority']) delete imageProps[key]; return React.createElement('img', imageProps); } },
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
    'lucide-react': icons,
    '@/app/components/SiteHeader': { default: empty },
    '@/app/components/ui/Spinner': { default: empty },
    '@/app/components/UserProfileModal': { default: empty },
    '@/app/components/proxy/ProxyBankTransferNotice': { ProxyBankTransferNotice: empty },
    '@/app/components/chat/ChatSafetyNotice': { default: empty },
  };
  for (const stub of Object.values(stubs)) { if (Object.hasOwn(stub, 'default')) stub.__esModule = true; }
  const load = sourceLoader(stubs);
  const hook = load('app/hooks/useChat.ts').useChat;
  let latest;
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/', pretendToBeVisual: true });
  const globals = {};
  const replacements = {
    window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (url, options) => { calls.requests.push({ url, options }); return fixture.request(url, options); },
    // Deterministic Realtime timers; no sleeps and no live sockets.
    setTimeout: (callback, delay) => { const id = Symbol(); pendingTimers.set(id, { callback, delay }); return id; },
    clearTimeout: (id) => pendingTimers.delete(id),
  };
  for (const [key, value] of Object.entries(replacements)) {
    globals[key] = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  dom.window.HTMLElement.prototype.scrollTo = () => {};
  const { createRoot } = require('react-dom/client');
  const root = createRoot(dom.window.document.getElementById('root'));
  function Probe() {
    latest = hook(role);
    return React.createElement('div', null, latest.messages.map((msg) => React.createElement('p', { key: msg.id, 'data-id': msg.id }, msg.content)));
  }
  fixture.get = () => latest;
  fixture.dom = dom;
  fixture.searchParams = searchParams;
  fixture.load = load;
  fixture.mount = async (Component = Probe) => { await React.act(async () => { root.render(React.createElement(Component)); }); };
  fixture.flush = async (callback = () => {}) => { await React.act(async () => { await callback(); }); };
  fixture.timers = async (maxDelay = Infinity) => {
    const ready = [...pendingTimers].filter(([, item]) => item.delay <= maxDelay);
    await fixture.flush(() => { for (const [id, item] of ready) { if (pendingTimers.delete(id)) item.callback(); } });
  };
  fixture.dispose = async () => {
    await React.act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of Object.entries(globals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  };
  return fixture;
}
