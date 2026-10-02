import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { artifactModule, ast, walkAst, compareBridgeArtifacts } from './bridge-candidate-compatibility.mjs';
import { verifyBridgeRuntimeMatrix } from './bridge-candidate-runtime.mjs';
import { sha256 } from './revalidation-bridge-build.mjs';
const require = createRequire(import.meta.url);
const fixture = JSON.parse(readFileSync('tests/fixtures/cloudflare-isr/stable-extracted.json')).source;
const adapter = readFileSync('app/utils/isrRevalidationBridge.mjs', 'utf8');
const validator = require('next/dist/server/api-utils/index.js').checkIsOnDemandRevalidate.toString();
const compat = '0'.repeat(32), lineage = sha256(compat);
function generation(g) {
  let source = fixture;
  const queue = artifactModule(source, '.open-next/.build/durable-objects/queue.js');
  const sites = [];
  walkAst(ast(queue), (n,p) => {
    const call = p.at(-1);
    if (n.type === 'Literal' && typeof n.value === 'string' && call?.type === 'CallExpression'
      && call.callee.property?.name === 'exec' && /buildId/.test(call.arguments[0]?.value ?? '') && call.arguments[0] !== n) sites.push(n);
  });
  let changed = queue; for (const n of sites.reverse()) changed = changed.slice(0,n.start) + JSON.stringify(`fixture-build-${g}`) + changed.slice(n.end);
  source = source.replace(queue,changed);
  return source + `\n// app/utils/isrRevalidationBridge.mjs\n${adapter}\n// .open-next/locally-revalidation-bridge.js\nvar bridge = createRevalidationBridge("${compat}", "${String(g+1).repeat(32)}");\n// next-auth-validator.js\n${validator}\n`;
}
const stable = generation(0), candidate = generation(1);
test('only four classified build-state sites change; callback token/API/schema/control flow unchanged', () => {
  const p = compareBridgeArtifacts(stable,candidate,lineage);
  assert.equal(p.classification,'BRIDGE_COMPATIBLE_BUILD_STATE_ONLY');assert.equal(p.differences.length,4);
  assert.equal(p.modules.DOShardedTagCache.classification,'DO_IMPLEMENTATION_UNCHANGED');
  assert(!JSON.stringify(p).includes(compat));
  assert.equal(compareBridgeArtifacts(stable,stable,lineage).classification,'DO_IMPLEMENTATION_UNCHANGED');
});
for (const [name,from,to] of [
  ['method','async revalidate(','async otherMethod('],
  ['schema','lastSuccess INTEGER','lastSuccess TEXT'],
  ['message','msg.MessageBody.url','msg.MessageBody.otherUrl'],
  ['alarm','async alarm(','async changedAlarm('],
]) test(`${name} change fails closed`, () => {
  assert(candidate.includes(from));
  assert.equal(compareBridgeArtifacts(stable,candidate.replace(from,to),lineage).classification,'DO_RUNTIME_CHANGED');
});
test('unknown artifact and changed compatibility lineage cannot pass', () => {
  assert.equal(compareBridgeArtifacts(stable,'unrecognized',lineage).classification,'UNKNOWN');
  assert.equal(compareBridgeArtifacts(stable,candidate,'a'.repeat(64)).classification,'UNKNOWN');
});
test('real Next auth, SQLite, all four directions, next generation and rollback', async () => {
  const p = await verifyBridgeRuntimeMatrix(stable,candidate);
  assert.equal(p.fourWay,'PASS');assert.equal(p.generation01,'PASS');assert.equal(p.generation12,'PASS');assert.equal(p.rollback,'PASS');assert.equal(p.buildState,'BUILD_STATE_RESET_EXPECTED');
});
