import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { applyRevalidationBridge, removeBridgeOutput } from './revalidation-bridge-build.mjs';

await removeBridgeOutput();
const command = path.join(process.cwd(), 'node_modules/.bin/opennextjs-cloudflare');
const result = spawnSync(command, ['build'], { stdio: 'inherit', env: process.env });
if (result.error || result.status !== 0) throw new Error('OPENNEXT_BUILD_FAILED');
const proof = await applyRevalidationBridge({ mode: process.env.LOCALLY_ISR_BRIDGE_SOURCE ?? 'local' });
console.log(JSON.stringify({ status: 'OPENNEXT_REVALIDATION_BRIDGE_BUILD_PASS', ...proof }));
