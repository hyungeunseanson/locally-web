import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { deferred, sourceLoader } from './helpers/chatRuntime.mjs';

// Exercise the real Header, AuthProvider and ViewModeProvider. Only I/O,
// Next routing and unrelated UI are fixtures; no Supabase account is created.
async function fixture({ role = 'anonymous', path = '/', unresolved = false } = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' + path });
  const globals = new Map();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    globals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const prefetches = [], pushes = [], timers = new Map(), pending = deferred();
  const originalTimeout = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
  globalThis.setTimeout = (fn, delay, ...args) => {
    if (delay !== 900) return originalTimeout(fn, delay, ...args);
    const id = Symbol(); timers.set(id, fn); return id;
  };
  globalThis.clearTimeout = id => timers.has(id) ? timers.delete(id) : originalClear(id);
  const user = role === 'anonymous' ? null : { id: 'local-fixture-user', user_metadata: {} };
  const app = ['anonymous', 'guest'].includes(role) ? null : { status: role };
  const client = {
    auth: { getUser: async () => ({ data: { user }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    from(table) {
      assert.equal(table, 'host_applications');
      const q = {};
      for (const method of ['select', 'eq', 'order', 'limit']) q[method] = () => q;
      q.maybeSingle = () => unresolved ? pending.promise : Promise.resolve({ data: app });
      return q;
    },
  };
  const empty = () => null;
  const router = { prefetch: href => prefetches.push(href), push: href => pushes.push(href) };
  const defaults = f => ({ default: f, __esModule: true });
  const sources = process.env.SITE_HEADER_FIXTURE_SOURCE ? {
    [resolve('app/components/SiteHeader.tsx')]: readFileSync(process.env.SITE_HEADER_FIXTURE_SOURCE, 'utf8'),
  } : {};
  const load = sourceLoader({
    '@/app/utils/supabase/client': { createClient: () => client },
    'next/navigation': { usePathname: () => path, useRouter: () => router },
    'next/link': defaults(({ children, ...props }) => React.createElement('a', props, children)),
    'next/dynamic': defaults(() => empty),
    'lucide-react': new Proxy({}, { get: (_, name) => () => React.createElement('svg', { 'data-icon': name }) }),
    '@/app/context/LanguageContext': { useLanguage: () => ({ t: key => key }) },
    '@/app/context/NotificationContext': { useNotification: () => ({ unreadCount: 0 }) },
    '@/app/utils/adminAccessClient': { fetchAdminAccess: async () => ({ isAdmin: false }) },
    './LanguageSelector': defaults(empty), './DesktopModeTransition': defaults(empty),
  }, sources);
  const { AuthProvider } = load('app/context/AuthContext.tsx');
  const { ViewModeProvider, useViewMode } = load('app/context/ViewModeContext.tsx');
  const Header = load('app/components/SiteHeader.tsx').default;
  let view;
  function Probe() {
    const value = useViewMode();
    React.useLayoutEffect(() => { view = value; }, [value]);
    return React.createElement(Header);
  }
  const root = createRoot(dom.window.document.getElementById('root'));
  try {
    await React.act(async () => root.render(React.createElement(AuthProvider,
      { initialUser: user, initialSessionResolved: true }, React.createElement(ViewModeProvider, null, React.createElement(Probe)))));
  } catch (error) { await cleanup(); throw error; }
  async function cleanup() {
    await React.act(async () => root.unmount());
    globalThis.setTimeout = originalTimeout; globalThis.clearTimeout = originalClear;
    dom.window.close();
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
  return { prefetches, pushes, timers, pending, app, get view() { return view; },
    async click(iconOrText, icon = false) {
      const button = icon ? dom.window.document.querySelector(`svg[data-icon="${iconOrText}"]`)?.parentElement
        : [...dom.window.document.querySelectorAll('button')].find(b => b.textContent.trim() === iconOrText);
      assert(button, iconOrText);
      await React.act(async () => button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
    }, cleanup };
}

const baseline = process.env.SITE_HEADER_PREFETCH_CONTROL === 'baseline';
for (const path of ['/', '/experiences/4659', '/host/dashboard']) {
  for (const role of ['anonymous', 'guest', 'approved', 'active', 'pending', 'revision', 'rejected']) {
    test(`${role} at ${path}: account and eligible Host warming`, async () => {
      const f = await fixture({ role, path });
      try {
        assert.equal(f.prefetches.filter(p => p === '/account').length, 1);
        const eligible = !['anonymous', 'guest'].includes(role);
        assert.equal(f.view.canUseHostView, eligible);
        assert.equal(f.prefetches.filter(p => p === '/host/dashboard?tab=reservations').length, baseline || eligible ? 1 : 0);
        assert.deepEqual(f.pushes, []);
      } finally { await f.cleanup(); }
    });
  }
}

test('Host lookup must resolve before warming; account is not repeated', async () => {
  const f = await fixture({ role: 'approved', unresolved: true });
  try {
    assert.equal(f.view.canUseHostView, false);
    assert.deepEqual(f.prefetches, baseline ? ['/account', '/host/dashboard?tab=reservations'] : ['/account']);
    await React.act(async () => f.pending.resolve({ data: f.app }));
    assert.equal(f.view.canUseHostView, true);
    assert.deepEqual(f.prefetches, ['/account', '/host/dashboard?tab=reservations']);
  } finally { await f.cleanup(); }
});

for (const role of ['approved', 'pending', 'revision', 'rejected', 'guest']) {
  test(`${role} explicit Host switch retains the existing navigation contract`, async () => {
    const f = await fixture({ role });
    try {
      await f.click('Menu', true); await f.click('host_mode');
      if (role === 'guest') {
        assert.equal(f.view.isHostView, false);
        assert.deepEqual(f.pushes, ['/become-a-host']);
        assert.equal(f.timers.size, 0);
      } else {
        assert.equal(f.view.isHostView, true);
        assert.equal(f.prefetches.at(-1), '/host/dashboard?tab=reservations');
        assert.equal(f.timers.size, 1);
        await React.act(async () => { for (const fn of f.timers.values()) fn(); });
        assert.deepEqual(f.pushes, ['/host/dashboard?tab=reservations']);
      }
    } finally { await f.cleanup(); }
  });
}
