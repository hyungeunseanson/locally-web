import { parse, parseExpressionAt } from 'acorn';
import { inspectQueueToken, sha256 } from './revalidation-bridge-build.mjs';

export function artifactModule(source, name) {
  const markers = [...source.matchAll(/^\/\/ (.+)$/gm)], found = markers.filter(m => m[1] === name);
  if (found.length !== 1) throw Error('DO_ARTIFACT_UNKNOWN');
  return source.slice(found[0].index, markers.find(m => m.index > found[0].index)?.index ?? source.length);
}
export function walkAst(n, fn, parents = []) {
  if (!n || typeof n !== 'object') return;
  if (n.type) fn(n, parents);
  for (const [k, v] of Object.entries(n)) {
    if (['start', 'end', 'raw', 'loc'].includes(k)) continue;
    if (Array.isArray(v)) v.forEach(x => walkAst(x, fn, [...parents, n]));
    else if (v && typeof v === 'object') walkAst(v, fn, [...parents, n]);
  }
}
const clean = n => Array.isArray(n) ? n.map(clean) : n && typeof n === 'object'
  ? Object.fromEntries(Object.entries(n).filter(([k]) => !['start', 'end', 'raw', 'loc'].includes(k)).map(([k, v]) => [k, clean(v)])) : n;
export const ast = source => parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
export function nextValidator(source) {
  const marker = 'function checkIsOnDemandRevalidate(', at = source.indexOf(marker);
  if (at < 0 || source.indexOf(marker, at + 1) >= 0) throw Error('DO_ARTIFACT_UNKNOWN');
  return source.slice(at, parseExpressionAt(source, at, { ecmaVersion: 'latest' }).end);
}
export function bridgeCredentials(source) {
  const m = artifactModule(source, '.open-next/locally-revalidation-bridge.js'), calls = [];
  walkAst(ast(m), n => { if (n.type === 'CallExpression' && n.callee.name === 'createRevalidationBridge') calls.push(n); });
  if (calls.length !== 1 || calls[0].arguments.length !== 2 || !calls[0].arguments.every(a => a.type === 'Literal' && /^[a-f0-9]{32}$/.test(a.value))) throw Error('DO_ARTIFACT_UNKNOWN');
  return calls[0].arguments.map(a => a.value);
}

// Record and classify every changed literal BEFORE replacing only those four
// reviewed build-scope sites for structural comparison. Token changes never qualify.
export function compareBridgeArtifacts(stable, candidate, compatSha256) {
  try {
    const differences = [], modules = {};
    const credentials = [stable, candidate].map(bridgeCredentials);
    if (credentials.some(([c]) => sha256(c) !== compatSha256)) return { classification: 'UNKNOWN' };
    for (const file of ['app/utils/isrRevalidationBridge.mjs', '.open-next/middleware/open-next.config.mjs']) {
      if (artifactModule(stable, file).trim() !== artifactModule(candidate, file).trim()) return { classification: 'DO_RUNTIME_CHANGED' };
    }
    if (nextValidator(stable) !== nextValidator(candidate)) return { classification: 'DO_RUNTIME_CHANGED' };
    for (const [name, file] of [['DOQueueHandler', 'queue'], ['DOShardedTagCache', 'sharded-tag-cache']]) {
      const path = `.open-next/.build/durable-objects/${file}.js`, texts = [stable, candidate].map(s => artifactModule(s, path));
      if (name === 'DOQueueHandler' && texts.some(s => sha256(inspectQueueToken(s).value) !== compatSha256)) return { classification: 'DO_RUNTIME_CHANGED' };
      const trees = texts.map(ast), entries = trees.map(tree => {
        const list = []; walkAst(tree, (n, p) => { if (n.type === 'Literal') list.push({ n, p }); }); return list;
      });
      if (entries[0].length !== entries[1].length) return { classification: 'DO_RUNTIME_CHANGED' };
      for (let i = 0; i < entries[0].length; i++) {
        const pair = entries.map(e => e[i]); if (pair[0].n.value === pair[1].n.value) continue;
        const allowed = pair.every(({ n, p }) => {
          const call = p.at(-1), method = [...p].reverse().find(x => x.type === 'MethodDefinition')?.key.name;
          const sql = call?.arguments?.[0]?.value;
          return name === 'DOQueueHandler' && typeof n.value === 'string' && n.value.length > 0
            && call?.type === 'CallExpression' && call.callee?.property?.name === 'exec'
            && ((method === 'initState' && call.arguments[1] === n && ['DELETE FROM failed_state WHERE buildId != ?', 'DELETE FROM sync WHERE buildId != ?'].includes(sql))
              || (method === 'addToFailedState' && call.arguments[3] === n && sql === 'INSERT OR REPLACE INTO failed_state (id, data, buildId) VALUES (?, ?, ?)')
              || (method === 'executeRevalidation' && call.arguments[2] === n && sql === 'INSERT OR REPLACE INTO sync (id, lastSuccess, buildId) VALUES (?, unixepoch(), ?)'));
        });
        if (!allowed) return { classification: 'DO_RUNTIME_CHANGED' };
        differences.push({ class: name, classification: 'BUILD_ID_ONLY', method: [...pair[0].p].reverse().find(n => n.type === 'MethodDefinition').key.name,
          values: pair.map(({ n }) => ({ type: 'string', length: n.value.length, sha256: sha256(n.value) })),
          impact: 'BUILD_STATE_RESET_EXPECTED; build-scoped failed_state/sync metadata only' });
        pair.forEach(({ n }) => { n.value = { reviewedBuildScope: true }; });
      }
      if (JSON.stringify(clean(trees[0])) !== JSON.stringify(clean(trees[1]))) return { classification: 'DO_RUNTIME_CHANGED' };
      modules[name] = { classification: texts[0] === texts[1] ? 'DO_IMPLEMENTATION_UNCHANGED' : 'BRIDGE_COMPATIBLE_BUILD_STATE_ONLY',
        stableSha256: sha256(texts[0]), candidateSha256: sha256(texts[1]), structuralContractIdentical: true };
    }
    return { classification: differences.length ? 'BRIDGE_COMPATIBLE_BUILD_STATE_ONLY' : 'DO_IMPLEMENTATION_UNCHANGED',
      compatSha256, modules, differences, nextAuthenticationUnchanged: true, workerClientsUnchanged: true };
  } catch { return { classification: 'UNKNOWN' }; }
}
