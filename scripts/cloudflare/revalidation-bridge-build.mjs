import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync, brotliDecompressSync } from 'node:zlib';
import { parse } from 'acorn';
import { resolveCloudflareReadCredentials } from './verify-production-deploy-contract.mjs';

const PATCH_ERROR = 'OPENNEXT_REVALIDATION_BRIDGE_PATCH_CONTRACT_CHANGED';
const QUEUE_PATH = '.open-next/.build/durable-objects/queue.js';
const PRIVATE_PATH = '.open-next/locally-revalidation-bridge.js';
const EVIDENCE_PATH = '.open-next/locally-revalidation-bridge-proof.json';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const HEX = /^[a-f0-9]{64}$/;
export const sha256 = value => createHash('sha256').update(value).digest('hex');
const requireContract = ok => { if (!ok) throw new Error(PATCH_ERROR); };
function tree(source) { try { return parse(source, { ecmaVersion: 'latest', sourceType: 'module' }); } catch { throw new Error(PATCH_ERROR); } }
function walk(node, visit, parents = []) {
  if (!node || typeof node !== 'object') return;
  if (node.type) visit(node, parents);
  for (const [key, value] of Object.entries(node)) {
    if (['start', 'end', 'raw', 'loc'].includes(key)) continue;
    if (Array.isArray(value)) value.forEach(item => walk(item, visit, [...parents, node]));
    else if (value && typeof value === 'object') walk(value, visit, [...parents, node]);
  }
}
const keyName = property => property?.key?.name ?? property?.key?.value;
function property(object, name) {
  requireContract(object?.type === 'ObjectExpression');
  const found = object.properties.filter(p => keyName(p) === name && !p.computed && p.kind === 'init');
  requireContract(found.length === 1);
  return found[0];
}

// AST location guards, not a global replacement. Errors never contain source,
// literal values or parser diagnostics (which can include private source text).
export function inspectQueueToken(source) {
  const ast = tree(source), sites = [], headers = [], classes = [];
  walk(ast, (n, parents) => {
    if (n.type === 'VariableDeclarator' && n.id.name === 'DOQueueHandler') classes.push(n.init);
    if (n.type === 'Property' && keyName(n) === 'x-prerender-revalidate') headers.push(n);
    if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression'
      && n.callee.property.name === 'fetch' && n.callee.object.type === 'MemberExpression'
      && n.callee.object.object.type === 'ThisExpression' && n.callee.object.property.name === 'service') {
      const method = [...parents].reverse().find(p => p.type === 'MethodDefinition');
      const cls = [...parents].reverse().find(p => p.type === 'ClassExpression');
      sites.push({ call: n, method, cls });
    }
  });
  requireContract(classes.length === 1 && sites.length === 1 && headers.length === 1);
  const { call, method, cls } = sites[0];
  requireContract(cls === classes[0] && cls.superClass?.name === 'DurableObject'
    && method?.key.name === 'executeRevalidation' && method.value.async && call.arguments.length === 2);
  const opts = call.arguments[1];
  requireContract(property(opts, 'method').value.value === 'HEAD');
  const h = property(opts, 'headers').value;
  requireContract(h.properties.length === 2 && h.properties.every(p => p.type === 'Property'));
  requireContract(property(h, 'x-isr').value.value === '1');
  const token = property(h, 'x-prerender-revalidate');
  requireContract(token === headers[0] && token.value.type === 'Literal' && /^[a-f0-9]{32}$/.test(token.value.value));
  let occurrences = 0;
  walk(ast, n => { if (n.type === 'Literal' && n.value === token.value.value) occurrences++; });
  requireContract(occurrences === 1);
  return { value: token.value.value, start: token.value.start, end: token.value.end };
}

export function patchQueueArtifact(source, currentPreviewId, compatToken) {
  requireContract(/^[a-f0-9]{32}$/.test(currentPreviewId) && /^[a-f0-9]{32}$/.test(compatToken));
  const token = inspectQueueToken(source);
  requireContract(sha256(token.value) === sha256(currentPreviewId));
  const patched = source.slice(0, token.start) + JSON.stringify(compatToken) + source.slice(token.end);
  requireContract(inspectQueueToken(patched).value === compatToken);
  return patched;
}

export function queueModuleFromProvider(source) {
  const markers = [...source.matchAll(/^\/\/ (.+)$/gm)];
  const found = markers.filter(m => m[1] === QUEUE_PATH);
  requireContract(found.length === 1);
  return source.slice(found[0].index, markers.find(m => m.index > found[0].index)?.index ?? source.length);
}

export async function readProviderCompatToken({ policy, credentials, fetchImplementation = fetch }) {
  // Only GET endpoints; never pull messages, read DO storage, or persist the
  // provider bundle. Recheck deployment after reading to detect a concurrent rollout.
  try {
    requireContract(policy.workerName === 'locally-web-opennext-production' && UUID.test(policy.baselineVersionId) && HEX.test(policy.compatTokenSha256));
    const base = `https://api.cloudflare.com/client/v4/accounts/${credentials.accountId}/workers/scripts/${policy.workerName}`;
    const get = async suffix => fetchImplementation(base + suffix, { method: 'GET', headers: { Authorization: `Bearer ${credentials.apiToken}` } });
    const json = async suffix => { const r = await get(suffix); const b = await r.json(); requireContract(r.ok && b.success); return b.result; };
    const current = async () => {
      const r = await json('/deployments');
      const d = [...(r.deployments ?? r)].sort((a,b) => Date.parse(b.created_on)-Date.parse(a.created_on))[0];
      requireContract(d?.versions?.length === 1 && d.versions[0].percentage === 100 && UUID.test(d.versions[0].version_id));
      return { deploymentId: d.id, versionId: d.versions[0].version_id };
    };
    const before = await current();
    const v = await json(`/versions/${before.versionId}`);
    requireContract(v.id === before.versionId && v.resources.script.named_handlers.some(h => h.name === 'DOQueueHandler' && h.handlers.includes('class')));
    const response = await get('/content/v2');
    const etag = response.headers.get('etag')?.replace(/^"|"$/g, '');
    requireContract(response.ok && HEX.test(etag) && etag === v.resources.script.etag);
    const form = await response.formData();
    const scripts = [...form.values()].filter(v => typeof v !== 'string' && v.name.endsWith('.js'));
    requireContract(scripts.length === 1);
    const token = inspectQueueToken(queueModuleFromProvider(await scripts[0].text())).value;
    requireContract(sha256(token) === policy.compatTokenSha256);
    const after = await current();
    requireContract(JSON.stringify(before) === JSON.stringify(after));
    return { token, provenance: { kind: 'provider', ...before, etag, etagMatch: true, compatSha256: sha256(token), length: token.length } };
  } catch { throw new Error('OPENNEXT_REVALIDATION_BRIDGE_PROVENANCE_FAILED'); }
}

export async function assertNoClientTokenLeakage(roots, tokens) {
  let files = 0;
  async function scan(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await scan(file);
      else {
        // Refuse symlinks so an unexpected output layout cannot evade the scan.
        requireContract(entry.isFile());
        let bytes = await readFile(file); files++;
        try {
          if (file.endsWith('.gz')) bytes = gunzipSync(bytes);
          if (file.endsWith('.br')) bytes = brotliDecompressSync(bytes);
        } catch { throw new Error(PATCH_ERROR); }
        if (tokens.some(token => bytes.includes(Buffer.from(token)))) throw new Error('OPENNEXT_REVALIDATION_BRIDGE_CLIENT_TOKEN_LEAK');
      }
    }
  }
  for (const root of roots) await scan(root);
  requireContract(files > 0);
  return files;
}

export async function removeBridgeOutput(root = process.cwd()) {
  await Promise.all([PRIVATE_PATH, EVIDENCE_PATH].map(p => rm(path.join(root, p), { force: true })));
}

export async function applyRevalidationBridge({ root = process.cwd(), mode = 'local', credentials, fetchImplementation } = {}) {
  await removeBridgeOutput(root);
  try {
    requireContract(['provider', 'fixture', 'local'].includes(mode));
    const pkg = JSON.parse(await readFile(path.join(root, 'node_modules/@opennextjs/cloudflare/package.json'), 'utf8'));
    requireContract(pkg.version === '1.19.6');
    const manifest = JSON.parse(await readFile(path.join(root, '.next/prerender-manifest.json'), 'utf8'));
    const current = manifest.preview.previewModeId;
    requireContract(/^[a-f0-9]{32}$/.test(current));
    const policy = JSON.parse(await readFile(path.join(root, 'config/cloudflare/revalidation-bridge.json'), 'utf8'));
    const inherited = mode === 'provider'
      ? await readProviderCompatToken({ policy, credentials: credentials ?? resolveCloudflareReadCredentials(), fetchImplementation })
      : { token: mode === 'fixture' ? '0'.repeat(32) : current, provenance: { kind: mode, compatSha256: sha256(mode === 'fixture' ? '0'.repeat(32) : current), length: 32 } };
    const queuePath = path.join(root, QUEUE_PATH);
    const original = await readFile(queuePath, 'utf8');
    const patched = patchQueueArtifact(original, current, inherited.token);
    const privateModule = `// Generated server-only credentials. Never log or commit.\nimport { createRevalidationBridge } from '../app/utils/isrRevalidationBridge.mjs';\nexport default createRevalidationBridge(${JSON.stringify(inherited.token)}, ${JSON.stringify(current)});\n`;
    tree(privateModule);
    const scannedFiles = await assertNoClientTokenLeakage([path.join(root, '.open-next/assets'), path.join(root, '.next/static')], [inherited.token, current]);
    await writeFile(queuePath, patched, { mode: 0o600 });
    await mkdir(path.join(root, '.open-next'), { recursive: true });
    await writeFile(path.join(root, PRIVATE_PATH), privateModule, { mode: 0o600 });
    const proof = { ...inherited.provenance, currentSha256: sha256(current), originalQueueSha256: sha256(original), patchedQueueSha256: sha256(patched), scannedFiles, clientLeakage: false };
    await writeFile(path.join(root, EVIDENCE_PATH), JSON.stringify(proof, null, 2), { mode: 0o600 });
    return proof;
  } catch (error) {
    await removeBridgeOutput(root);
    // Do not include error cause: filesystem/parser errors could contain tokens.
    const safe = [PATCH_ERROR, 'OPENNEXT_REVALIDATION_BRIDGE_PROVENANCE_FAILED', 'OPENNEXT_REVALIDATION_BRIDGE_CLIENT_TOKEN_LEAK'];
    throw new Error(safe.includes(error?.message) ? error.message : PATCH_ERROR);
  }
}
