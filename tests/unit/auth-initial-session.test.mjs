/* eslint-disable react-hooks/globals -- Runtime probes capture the actual context for assertions. */
import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sourceLoader, deferred } from './helpers/chatRuntime.mjs';
import { JSDOM } from 'jsdom';
import { createRoot } from 'react-dom/client';

function fixture(getUser = () => { throw new Error('SSR must not resolve auth again'); }) {
  const client = {
    auth: { getUser, onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  };
  return sourceLoader({ '@/app/utils/supabase/client': { createClient: () => client } })('app/context/AuthContext.tsx');
}

for (const { name, props, loading, resolved } of [
  { name: 'server-resolved anonymous session', props: { initialSessionResolved: true, initialUser: null }, loading: false, resolved: true },
  { name: 'client-only unresolved session', props: {}, loading: true, resolved: false },
  { name: 'initial user without resolution flag', props: { initialUser: { id: 'valid' } }, loading: false, resolved: false },
  { name: 'server-resolved initial user', props: { initialSessionResolved: true, initialUser: { id: 'valid' } }, loading: false, resolved: false },
]) {
  test(`AuthProvider SSR respects ${name}`, () => {
    const { AuthProvider, useAuth } = fixture();
    let state;
    function Probe() { state = useAuth(); return null; }
    renderToStaticMarkup(React.createElement(AuthProvider, props, React.createElement(Probe)));
    assert.equal(state.isLoading, loading);
    assert.equal(state.hostStatusResolved, resolved);
    assert.equal(state.user, props.initialUser ?? null);
  });
}

test('unresolved client auth keeps loading until getUser completes', async () => {
  const pending = deferred();
  let calls = 0, state;
  const { AuthProvider, useAuth } = fixture(() => { calls++; return pending.promise; });
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
  const originals = new Map();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const root = createRoot(dom.window.document.getElementById('root'));
  function Probe() { state = useAuth(); return React.createElement('p', null, state.isLoading ? 'loading' : 'anonymous'); }
  try {
    await React.act(async () => root.render(React.createElement(AuthProvider, null, React.createElement(Probe))));
    assert.equal(calls, 1);
    assert.equal(state.isLoading, true);
    await React.act(async () => pending.resolve({ data: { user: null }, error: null }));
    assert.equal(state.isLoading, false);
    assert.equal(state.user, null);
    assert.equal(dom.window.document.querySelector('p').textContent, 'anonymous');
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    for (const [key, original] of originals) {
      if (original) Object.defineProperty(globalThis, key, original); else delete globalThis[key];
    }
  }
});
