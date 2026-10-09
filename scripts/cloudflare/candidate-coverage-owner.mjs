import { createHash } from 'node:crypto';
import { CandidateReleaseBlocked } from './candidate-release-contract.mjs';

const owners = new WeakMap(), contexts = new WeakMap();
const preparedContexts = new WeakMap();
let sequence = 0;
const digest = value => createHash('sha256').update(value).digest('hex');
const sourcePath = url => { try { return new URL(url || 'about:blank').pathname; } catch { return '[non-url]'; } };
const blocked = () => new CandidateReleaseBlocked('candidate_coverage_owner_violation');
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

// Await initialization before newPage resolves. Attaching Debugger/Profiler
// after a document is already paused by routing can deadlock navigation.
export function prepareCoverageContext(context, origin, preparePage) {
  if (preparedContexts.has(context)) {
    const state = preparedContexts.get(context);
    if (state.origin !== origin) throw blocked();
    if (preparePage) state.preparePages.add(preparePage);
    return;
  }
  const state = { origin, preparePages: new Set(preparePage ? [preparePage] : []) };
  preparedContexts.set(context, state);
  const createPage = context.newPage.bind(context);
  context.newPage = async (...args) => {
    const page = await createPage(...args);
    await coverageOwnerFor(page, origin).ready;
    await Promise.all([...state.preparePages].map(prepare => prepare(page)));
    return page;
  };
}

// One lifecycle and one serialized delta stream per page/target. Diagnostics
// read immutable accumulated snapshots; they never consume independent counters.
export function coverageOwnerFor(page, origin) {
  const existing = owners.get(page);
  if (existing) {
    if (existing.origin !== origin) throw blocked();
    return existing;
  }
  const ownerId = `coverage-page-${++sequence}`, listeners = new Set(), scripts = new Map(), audit = [];
  let cdp, targetId, generation = 0, snapshotId = 0, closing = false, finalized = false, cleanupComplete = false;
  let queue = Promise.resolve(), finalization;
  const mark = (method, caller) => audit.push({ method, caller, ownerId, targetId, generation, ms: performance.now() });
  const read = () => freeze(structuredClone({ ownerId, targetId, generation, snapshotId, finalized, cleanupComplete,
    scripts: [...scripts.values()].map(({ url, ranges, ...row }) => ({ ...row,
      pathname: sourcePath(url), urlFingerprint: digest(url), ranges: [...ranges.values()] })), audit }));
  const ready = (async () => {
    cdp = await page.context().newCDPSession(page);
    ({ targetInfo: { targetId } } = await cdp.send('Target.getTargetInfo'));
    cdp.on('Runtime.executionContextsCleared', () => { generation += 1; });
    cdp.on('Debugger.scriptParsed', row => {
      const key = `${generation}:${row.executionContextId}:${row.scriptId}`;
      scripts.set(key, { key, scriptId: row.scriptId, executionContextId: row.executionContextId,
        generation, url: row.url, parsedMs: performance.now(), ranges: new Map(), sha256: null });
    });
    await cdp.send('Runtime.enable');
    await cdp.send('Debugger.enable');
    mark('Profiler.enable', 'owner'); await cdp.send('Profiler.enable');
    mark('Profiler.startPreciseCoverage', 'owner');
    await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
    // Expose only non-Profiler operations needed for native network receipts.
    return { on: cdp.on.bind(cdp), send: (method, params) => {
      if (method.startsWith('Profiler.')) throw blocked();
      return cdp.send(method, params);
    } };
  })();
  function collect(caller = 'gate') {
    if (closing || page.isClosed()) return Promise.reject(blocked());
    const task = queue.then(async () => {
      await ready;
      mark('Profiler.takePreciseCoverage', caller);
      const snapshot = await cdp.send('Profiler.takePreciseCoverage');
      for (const row of snapshot.result) {
        const script = [...scripts.values()].find(s => s.generation === generation && s.scriptId === row.scriptId);
        if (!script) continue; // Missing parsed/context identity cannot prove execution.
        row.functions.forEach((fn, index) => fn.ranges.forEach(range => {
          const key = `${index}:${range.startOffset}:${range.endOffset}`;
          const before = script.ranges.get(key);
          script.ranges.set(key, { functionIndex: index, startOffset: range.startOffset, endOffset: range.endOffset,
            count: (before?.count ?? 0) + range.count, observedMs: performance.now(), snapshotId: snapshotId + 1 });
        }));
        if (!script.sha256 && script.ranges.size && [...script.ranges.values()].some(r => r.count > 0)
          && script.url.startsWith(origin + '/_next/static/')) {
          const { scriptSource } = await cdp.send('Debugger.getScriptSource', { scriptId: script.scriptId });
          script.sha256 = digest(Buffer.from(scriptSource));
        }
      }
      snapshotId += 1;
      const evidence = read();
      for (const listener of listeners) listener(evidence);
      return evidence;
    });
    queue = task;
    return task;
  }
  const prove = (url, sha256) => {
    if (!snapshotId || finalized || page.isClosed()) return null;
    const script = [...scripts.values()].find(s => s.generation === generation && s.url === url && s.sha256 === sha256
      && [...s.ranges.values()].some(r => r.count > 0));
    return script ? { ownerId, targetId, generation, snapshotId, scriptId: script.scriptId,
      executionContextId: script.executionContextId, sha256, executed: true } : null;
  };
  async function finalize() {
    if (finalization) return finalization;
    finalization = (async () => {
      let error;
      try { await collect('before-teardown'); finalized = true; }
      catch (failure) { error = failure; }
      closing = true;
      try {
        await ready;
        mark('Profiler.stopPreciseCoverage', 'owner'); await cdp.send('Profiler.stopPreciseCoverage');
        mark('Profiler.disable', 'owner'); await cdp.send('Profiler.disable');
      } catch (failure) { error ??= failure; }
      finally {
        if (cdp) {
          try { await cdp.detach(); cleanupComplete = true; }
          catch (failure) { error ??= failure; }
        }
      }
      if (error) throw error;
    })();
    return finalization;
  }
  const owner = { origin, ownerId, ready, collect, read, prove, finalize,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); } };
  owners.set(page, owner);
  const close = page.close.bind(page);
  page.close = async (...args) => { try { await finalize(); } finally { await close(...args); } };
  const context = page.context();
  if (!contexts.has(context)) {
    const pageOwners = new Set(); contexts.set(context, pageOwners);
    const closeContext = context.close.bind(context);
    context.close = async (...args) => {
      try { await Promise.all([...pageOwners].map(o => o.finalize())); }
      finally { await closeContext(...args); }
    };
  }
  contexts.get(context).add(owner);
  ready.catch(() => {});
  return owner;
}
