import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

export const CONTRACTS = {
 migrations: [['scripts/supabase/check-production-baseline.mjs'],['scripts/supabase/check-production-current-state.mjs'],['scripts/supabase/production-current-state-contract.test.mjs']],
 environment: [['scripts/cloudflare/check-migration-readiness.mjs'],['node_modules/@playwright/test/cli.js','test','-c','playwright.contract-preflight.config.ts','239-cloudflare-migration-readiness-contract']],
 images: [['--test','scripts/cloudflare/reconcile-public-host-profile-images.test.mjs','scripts/cloudflare/reconcile-public-experience-images.test.mjs'],['--conditions=react-server','node_modules/@playwright/test/cli.js','test','-c','playwright.contract-preflight.config.ts','242-public-experience-media-key-contract']],
 namespace: [['--test','tests/unit/media-lifecycle-foundation.test.mjs','tests/unit/avatar-media.test.mjs','tests/unit/host-profile-media.test.mjs','tests/unit/community-media.test.mjs']],
 queue: [['--conditions=react-server','node_modules/@playwright/test/cli.js','test','-c','playwright.contract-preflight.config.ts','243-public-experience-media-queue-engine','244-public-experience-media-queue-consumer','245-public-experience-media-queue-producer','246-public-experience-media-producer-integration']],
 workflow: [['node_modules/@playwright/test/cli.js','test','-c','playwright.contract-preflight.config.ts','236-cloudflare-reconciliation-readonly-safety']],
};

export function affectedContracts(paths) {
 const selected = new Set();
 for (const file of paths) {
  if (/^(\.github\/|config\/|package(?:-lock)?\.json$|wrangler|cloudflare-worker|next\.config|scripts\/ci\/)/.test(file)) return Object.keys(CONTRACTS);
  if (/\.sql$|^supabase\/|scripts\/supabase\//.test(file)) selected.add('migrations');
  if (/^(app\/|scripts\/cloudflare\/|types\/)/.test(file)) selected.add('environment');
  if (/image|Image|Media|media|upload|Upload/.test(file)) {selected.add('images');selected.add('namespace');selected.add('queue');}
  if (/queue|Queue|worker|Worker/.test(file)) selected.add('queue');
  if (/^tests\/|^playwright|backup/.test(file)) selected.add('workflow');
 }
 return Object.keys(CONTRACTS).filter(key=>selected.has(key));
}

export function fixtureEnvironment(source) {
 const env = Object.fromEntries(['PATH','HOME','TMPDIR','SystemRoot'].filter(key=>source[key]).map(key=>[key,source[key]]));
 return {...env,CI:'true',NEXT_PUBLIC_SITE_URL:'http://127.0.0.1:3000',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54329',NEXT_PUBLIC_SUPABASE_ANON_KEY:'sb_publishable_contract_preflight_fixture',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_contract_preflight_fixture',NEXT_TELEMETRY_DISABLED:'1'};
}

function main() {
 const args=process.argv.slice(2);
 const base=args.find(arg=>arg.startsWith('--base='))?.slice(7);
 if(base?.startsWith('-')) throw Error('Invalid diff base');
 const diff=spawnSync('git',['diff','--name-only',...(base?[`${base}...HEAD`]:['HEAD'])],{encoding:'utf8'});
 if(diff.status!==0) throw Error('Cannot determine changed paths');
 const groups=args.includes('--all')?Object.keys(CONTRACTS):affectedContracts(diff.stdout.trim().split('\n'));
 console.log(JSON.stringify({groups,mode:args.includes('--plan')?'plan':'verify',productionAccess:false}));
 if(args.includes('--plan')) return;
 const failures=[];
 for(const group of groups) for(const command of CONTRACTS[group]) {
  console.log(`CONTRACT_PREFLIGHT ${group} ${command.join(' ')}`);
  const result=spawnSync(process.execPath,command,{stdio:'inherit',env:fixtureEnvironment(process.env)});
  if(result.status!==0) failures.push({group,command:command[0],status:result.status});
 }
 if(failures.length) {console.error(JSON.stringify({failures}));process.exitCode=1;}
 else console.log('CONTRACT_DRIFT_PREFLIGHT_PASS');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main();
