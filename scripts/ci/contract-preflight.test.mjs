import assert from 'node:assert/strict';
import test from 'node:test';
import {affectedContracts,fixtureEnvironment,CONTRACTS} from './contract-preflight.mjs';
test('changes select the full dependent boundary, including new SQL and runtime environment reads',()=>{
 assert.deepEqual(affectedContracts(['docs/migrations/new-protected.sql']),['migrations']);
 assert(affectedContracts(['app/hooks/newFeature.ts']).includes('environment'));
 const media=affectedContracts(['app/utils/hostProfileMediaContract.mjs']);
 for(const group of ['environment','images','namespace','queue'])assert(media.includes(group));
 assert.deepEqual(affectedContracts(['wrangler.jsonc']),Object.keys(CONTRACTS));
 assert.deepEqual(affectedContracts(['.github/workflows/new.yml']),Object.keys(CONTRACTS));
});
test('parent Production credentials and runtime flags cannot enter a fixture subprocess',()=>{
 const env=fixtureEnvironment({PATH:'/bin',HOME:'/fixture',CLOUDFLARE_API_TOKEN:'secret',AWS_SECRET_ACCESS_KEY:'secret',SUPABASE_SERVICE_ROLE_KEY:'production',NEXT_PUBLIC_SUPABASE_URL:'https://production.invalid',AVATAR_R2_SOURCE_ENABLED:'true',NODE_OPTIONS:'--require unsafe'});
 assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,'http://127.0.0.1:54329');
 assert.equal(env.SUPABASE_SERVICE_ROLE_KEY,'sb_secret_contract_preflight_fixture');
 for(const key of ['CLOUDFLARE_API_TOKEN','AWS_SECRET_ACCESS_KEY','AVATAR_R2_SOURCE_ENABLED','NODE_OPTIONS'])assert.equal(env[key],undefined);
});
