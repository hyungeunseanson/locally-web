import assert from 'node:assert/strict';
import test from 'node:test';
import { profile, verifyPinnedReleaseBrowser } from './verify-pinned-release-browser.mjs';

function fixture(overrides = {}) {
  const calls = [];
  const dependencies = {
    platform: 'darwin', architecture: 'arm64', playwrightVersion: '1.59.1',
    resolveRealPath: async path => path,
    hashFile: async path => path.endsWith('/browser') ? profile.executableSHA256 : profile.frameworkSHA256,
    browserType: { launch: async options => {
      calls.push({ event: 'launch', options });
      return {
        version: () => overrides.version || profile.browserVersion,
        newContext: async () => ({
          newPage: async () => ({ /* Deliberately no goto: verification must never request an app. */ }),
          newCDPSession: async () => ({ send: async method => {
            assert.equal(method, 'Browser.getVersion');
            return { product: overrides.product || 'Chrome/' + profile.browserVersion,
              revision: overrides.revision || profile.browserRevision };
          } }),
          close: async () => calls.push({ event: 'context-close' }),
        }),
        close: async () => calls.push({ event: 'browser-close' }),
      };
    } },
    ...overrides.dependencies,
  };
  return { calls, verify: path => verifyPinnedReleaseBrowser(path, dependencies) };
}

test('checks exact executable, engine and runtime revision without an application request', async () => {
  const f = fixture();
  const receipt = await f.verify('/synthetic/Contents/MacOS/browser');
  assert.equal(receipt.status, 'PINNED_EXPERIMENTAL_BROWSER_IDENTITY_PASS');
  assert.equal(receipt.applicationRequests, 0);
  assert.equal(receipt.gateInvoked, false);
  assert.deepEqual(f.calls.map(x => x.event), ['launch', 'context-close', 'browser-close']);
  assert.equal(f.calls[0].options.executablePath, '/synthetic/Contents/MacOS/browser');
});

for (const [name, dependencies, message] of [
  ['wrong OS', { platform: 'linux' }, /platform mismatch/],
  ['wrong architecture', { architecture: 'x64' }, /architecture mismatch/],
  ['wrong API version', { playwrightVersion: '1.64.0' }, /Playwright version mismatch/],
  ['tampered launcher', { hashFile: async () => '0'.repeat(64) }, /executable hash mismatch/],
  ['tampered Blink engine', { hashFile: async path => path.endsWith('/browser') ? profile.executableSHA256 : '0'.repeat(64) }, /framework hash mismatch/],
]) test(name + ' fails before launching', async () => {
  const f = fixture({ dependencies });
  await assert.rejects(f.verify('/synthetic/Contents/MacOS/browser'), message);
  assert.deepEqual(f.calls, []);
});

test('relative paths cannot silently select another installed browser', async () => {
  const f = fixture();
  await assert.rejects(f.verify('browser'), /absolute executable path/);
  assert.deepEqual(f.calls, []);
});

for (const [name, overrides, message] of [
  ['wrong runtime version', { version: '147.0.7727.15' }, /browser version mismatch/],
  ['wrong product', { product: 'Other/157.0.8091.0' }, /browser product mismatch/],
  ['wrong Git revision', { revision: '@' + '0'.repeat(40) }, /browser revision mismatch/],
]) test(name + ' fails and closes both disposable resources', async () => {
  const f = fixture(overrides);
  await assert.rejects(f.verify('/synthetic/Contents/MacOS/browser'), message);
  assert.deepEqual(f.calls.map(x => x.event), ['launch', 'context-close', 'browser-close']);
});
