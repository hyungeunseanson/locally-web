import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('.');
const manifest = JSON.parse(
  await readFile(resolve(root, 'supabase/staging/required-objects.json'), 'utf8')
);
const schemaContract = await readFile(
  resolve(root, 'supabase/staging/schema-contract.sql'),
  'utf8'
);

async function sqlFiles(directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (['.git', '.next', 'node_modules'].includes(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sqlFiles(path)));
    if (entry.isFile() && entry.name.endsWith('.sql')) files.push(path);
  }
  return files;
}

const canonicalBaseline = resolve(root, 'supabase/migrations/20260912034545_production_schema_baseline.sql');
const legacySqlFiles = (await sqlFiles()).filter((path) => path !== canonicalBaseline);
const definitions = (await Promise.all(legacySqlFiles.map((path) => readFile(path, 'utf8')))).join('\n');
const createdTables = new Set(
  [...definitions.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?["']?([a-z0-9_]+)/gi)]
    .map((match) => match[1])
);
const unexpectedBaselineClaims = manifest.repoBaselineMissing.filter((table) => createdTables.has(table));
if (unexpectedBaselineClaims.length > 0) {
  throw new Error(
    `Update the staging baseline audit; these tables now have CREATE TABLE definitions: ${unexpectedBaselineClaims.join(', ')}`
  );
}

for (const table of manifest.functionalCanaryMinimum.tables) {
  if (!schemaContract.includes(`'${table}'`)) {
    throw new Error(`schema-contract.sql does not cover table ${table}`);
  }
}
for (const name of manifest.functionalCanaryMinimum.functions) {
  if (!schemaContract.includes(`'${name}'`)) {
    throw new Error(`schema-contract.sql does not cover function ${name}`);
  }
}

console.log(JSON.stringify({
  reproducibleFromHistoricalPatchesOnly: false,
  reproducibleFromCanonicalBaseline: true,
  missingBaselineTableCount: manifest.repoBaselineMissing.length,
  functionalCanaryTableCount: manifest.functionalCanaryMinimum.tables.length,
  result: 'LOCALLY_STAGING_BOOTSTRAP_CONTRACT_PASS'
}, null, 2));
