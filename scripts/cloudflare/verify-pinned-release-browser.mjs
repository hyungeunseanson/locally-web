import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

export const profile = Object.freeze(JSON.parse(await readFile(
  new URL('./chromium8508456-profile.json', import.meta.url), 'utf8',
)));

async function fileSHA256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

// No downloads, user profile, application requests, environment overrides or
// Gate invocation. Test dependencies cannot be supplied through the CLI.
export async function verifyPinnedReleaseBrowser(executablePath, {
  platform = process.platform, architecture = process.arch,
  playwrightVersion = createRequire(import.meta.url)('@playwright/test/package.json').version,
  hashFile = fileSHA256, resolveRealPath = realpath, browserType = chromium,
} = {}) {
  assert.equal(platform, profile.platform, 'Pinned browser platform mismatch');
  assert.equal(architecture, profile.architecture, 'Pinned browser architecture mismatch');
  assert.equal(playwrightVersion, profile.playwright, 'Pinned Playwright version mismatch');
  assert(typeof executablePath === 'string' && isAbsolute(executablePath), 'An absolute executable path is required');
  const executable = await resolveRealPath(executablePath);
  assert.equal(await hashFile(executable), profile.executableSHA256, 'Pinned executable hash mismatch');
  const framework = await resolveRealPath(resolve(dirname(executable), profile.frameworkRelativePath));
  assert.equal(await hashFile(framework), profile.frameworkSHA256, 'Pinned framework hash mismatch');
  const browser = await browserType.launch({ headless: true, executablePath: executable });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    try {
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      const identity = await cdp.send('Browser.getVersion');
      assert.equal(browser.version(), profile.browserVersion, 'Pinned browser version mismatch');
      assert.equal(identity.product, 'Chrome/' + profile.browserVersion, 'Pinned browser product mismatch');
      assert.equal(identity.revision, profile.browserRevision, 'Pinned browser revision mismatch');
      return {
        status: 'PINNED_EXPERIMENTAL_BROWSER_IDENTITY_PASS', executablePath: executable,
        executableSHA256: profile.executableSHA256, frameworkSHA256: profile.frameworkSHA256,
        version: profile.browserVersion, revision: identity.revision, fixCommit: profile.fixCommit,
        playwright: playwrightVersion, applicationRequests: 0, gateInvoked: false,
        compatibility: profile.compatibility,
      };
    } finally { await context.close(); }
  } finally { await browser.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  assert.equal(process.argv.length, 3, 'Usage: node verify-pinned-release-browser.mjs /absolute/executable');
  console.log(JSON.stringify(await verifyPinnedReleaseBrowser(process.argv[2]), null, 2));
}
