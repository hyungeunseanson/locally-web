import { CandidateReleaseBlocked } from './candidate-release-contract.mjs';

const fail = stage => { const e = new CandidateReleaseBlocked('candidate_cache_revalidation_failed'); e.cacheStage = stage; throw e; };
export const isFontCachePath = url => !url.search && !url.hash && /^\/_next\/static\/media\/[\w.-]+\.woff2$/.test(url.pathname);
export function assertFontLineage(previous, current) {
  for (const key of ['ownerId', 'targetId', 'generation', 'frameId']) {
    if ((key === 'generation' ? !Number.isInteger(previous.nativeIdentity?.[key]) || previous.nativeIdentity[key] < 0 : !previous.nativeIdentity?.[key]) || previous.nativeIdentity[key] !== current.nativeIdentity?.[key]) fail('font-lineage');
  }
  if (!previous.nativeIdentity.requestId || !current.nativeIdentity.requestId || previous.nativeIdentity.requestId !== current.nativeIdentity.predecessorId
    || previous.nativeIdentity.requestId === current.nativeIdentity.requestId) fail('font-request-lineage');
}

// Chromium FontResource clears encoded data after decoding and revalidates the
// same resource object. Freshly re-read its original native request bytes, then
// compare the currently loaded CSS face's native glyph identity with those bytes.
// Accepted proofs cause zero HTTP reads. No artifact/Node-body substitution,
// second Profiler, or retry. An unused cached CSS face must activate without HTTP.
export async function proveCachedFont({ page, cdp, owner, url, bytes, identity, readCount }) {
  const before = owner.read(), beforeReads = readCount();
  if (page.isClosed() || before.finalized || before.targetId !== identity.targetId || before.generation !== identity.generation) fail('font-document-identity');
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const token = 'locally_cache_font_' + identity.requestId.replace(/[^a-zA-Z0-9]/g, '_');
  try {
    const descriptors = await page.evaluate(async ({ url, encoded, token }) => {
      const rows = [];
      const clean = v => v.trim().replace(/^['"]|['"]$/g, '');
      const visit = (rules, base) => { for (const rule of rules) {
        if (rule.type === CSSRule.FONT_FACE_RULE) {
          const sources = [...rule.style.getPropertyValue('src').matchAll(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g)].map(m => new URL(m[2], base).href);
          if (sources.length === 1 && sources[0] === url && !/\blocal\s*\(/i.test(rule.style.getPropertyValue('src'))) rows.push({ family: clean(rule.style.getPropertyValue('font-family')), weight: rule.style.getPropertyValue('font-weight') || 'normal', style: rule.style.getPropertyValue('font-style') || 'normal' });
        } else if (rule.cssRules) visit(rule.cssRules, base);
      } };
      for (const sheet of document.styleSheets) visit(sheet.cssRules, sheet.href || document.baseURI);
      const unique = [...new Map(rows.map(r => [JSON.stringify(r), r])).values()];
      if (unique.length !== 1) throw new Error('font-css-identity');
      const face = unique[0];
      const loaded = [...document.fonts].filter(f => clean(f.family) === face.family && f.weight === face.weight && f.style === face.style);
      if (loaded.length !== 1) throw new Error('font-face-count');
      // The response finishes before the renderer resolves an already loading
      // CSS FontFace. Await only that existing load; never start a URL load.
      // Activate an unused CSS face only from the already cached resource.
      // The outer read-count guard rejects any resulting HTTP request/replay.
      const cachedFaceActivated = loaded[0].status === 'unloaded';
      if (cachedFaceActivated) await loaded[0].load();
      else if (loaded[0].status === 'loading') await loaded[0].loaded;
      if (loaded[0].status !== 'loaded') throw new Error('font-status-' + loaded[0].status);
      if (!document.fonts.check(`${face.style} ${face.weight} 32px "${face.family}"`, 'Aa0123')) throw new Error('font-selection-not-ready');
      const native = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
      const expected = new FontFace(token, native.buffer); await expected.load(); document.fonts.add(expected);
      // Store transient native-byte face solely for guaranteed cleanup.
      window[token] = expected;
      for (const [name, family, weight, style] of [['actual', face.family, face.weight, face.style], ['expected', token, 'normal', 'normal']]) {
        const el = document.createElement('span'); el.dataset.locallyCacheFont = token + '_' + name; el.textContent = 'Aa0123';
        el.style.cssText = 'position:absolute;left:-10000px;top:0;font-size:32px;font-variant:normal;font-feature-settings:normal;';
        el.style.setProperty('font-family', '"' + family + '"', 'important'); el.style.setProperty('font-weight', weight, 'important'); el.style.setProperty('font-style', style, 'important');
        document.body.appendChild(el); el.getBoundingClientRect();
      }
      return { loaded: true, sourceURLMatches: true, cachedFaceActivated };
    }, { url, encoded: bytes.toString('base64'), token });
    const { root: { nodeId } } = await cdp.send('DOM.getDocument');
    const fontRows = [];
    for (const kind of ['actual', 'expected']) {
      const { nodeId: probe } = await cdp.send('DOM.querySelector', { nodeId, selector: `[data-locally-cache-font="${token}_${kind}"]` });
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: probe });
      if (fonts.length !== 1 || !fonts[0].isCustomFont || fonts[0].glyphCount !== 6) fail('font-native-glyphs');
      fontRows.push(fonts[0]);
    }
    if (JSON.stringify(fontRows[0]) !== JSON.stringify(fontRows[1])) fail('font-render-identity');
    if (readCount() !== beforeReads) fail('font-probe-network-read');
    const after = owner.read();
    if (after.targetId !== before.targetId || after.generation !== before.generation || page.isClosed()) fail('font-document-changed');
    return { ...identity, ...descriptors, rendered: true, customFont: true, glyphCount: 6,
      familyName: fontRows[0].familyName, postScriptName: fontRows[0].postScriptName,
      additionalHTTPReads: 0, provenance: 'native-predecessor-body-and-current-decoded-font' };
  } catch (error) {
    if (error.code === 'candidate_cache_revalidation_failed') throw error;
    const known = ['font-css-identity', 'font-face-count', 'font-status-unloaded', 'font-status-error', 'font-selection-not-ready'].find(stage => error.message.includes(stage));
    fail(known ?? (error.message.includes('node') && error.message.includes('id') ? 'font-cdp-node-identity' : 'font-native-render-' + error.name));
  } finally {
    await page.evaluate(token => {
      document.querySelectorAll('[data-locally-cache-font]').forEach(el => { if (el.dataset.locallyCacheFont.startsWith(token + '_')) el.remove(); });
      if (window[token]) { document.fonts.delete(window[token]); delete window[token]; }
    }, token);
  }
}
