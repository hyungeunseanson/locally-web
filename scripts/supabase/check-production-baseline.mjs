import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('.');
const manifest = JSON.parse(
  await readFile(resolve(root, 'supabase/staging/production-baseline.manifest.json'), 'utf8')
);
const stagingContract = JSON.parse(
  await readFile(resolve(root, 'supabase/staging/required-objects.json'), 'utf8')
);
const sql = await readFile(resolve(root, manifest.baselineMigration), 'utf8');
const outsideFunctions = sql.replace(/CREATE OR REPLACE FUNCTION[\s\S]*?\$function\$;/g, '');

function fail(message) {
  throw new Error(`Production baseline contract failed: ${message}`);
}
function matches(pattern) {
  return [...sql.matchAll(pattern)];
}
function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}
function exact(label, actual, expected) {
  if (JSON.stringify(sorted(actual)) !== JSON.stringify(sorted(expected))) {
    fail(`${label} differs\nactual=${JSON.stringify(sorted(actual))}\nexpected=${JSON.stringify(sorted(expected))}`);
  }
}

const tableBlocks = matches(
  /^create table "public"\."([^"]+)" \(\n([\s\S]*?)\n\);$/gim
);
const tableNames = tableBlocks.map((match) => match[1]);
const columnCount = tableBlocks.reduce(
  (count, match) => count + match[2].split('\n').filter((line) => /^  "[^"]+" /.test(line)).length,
  0
);
const viewNames = matches(/^create view "public"\."([^"]+)"/gim).map((match) => match[1]);
const sequenceNames = matches(/^alter sequence "public"\."([^"]+)" increment by /gim).map((match) => match[1]);
const functionDefinitions = matches(/^CREATE OR REPLACE FUNCTION /gim).length;
const functionIdentities = matches(/^alter function (public\.[^;]+) owner to postgres;$/gim)
  .map((match) => match[1]);
const triggerNames = matches(/^CREATE TRIGGER ([^\s]+) /gim)
  .map((match) => match[1].replaceAll('"', ''));
const policyCount = matches(/^create policy /gim).length;
const standaloneIndexes = matches(/^CREATE (?:UNIQUE )?INDEX /gim).length;
const constraintMatches = matches(
  /^alter table only "public"\."[^"]+" add constraint "[^"]+" (PRIMARY KEY|FOREIGN KEY|UNIQUE|CHECK) /gim
);

exact('public tables', tableNames, manifest.objects.publicTables);
exact('public views', viewNames, manifest.objects.publicViews);
exact('identity sequences', sequenceNames, manifest.objects.sequences);
exact('function overloads', functionIdentities, manifest.objects.functionOverloads);
exact(
  'Locally-owned triggers',
  triggerNames,
  manifest.objects.triggers.map((identity) => identity.split('.').at(-1))
);

if (columnCount !== manifest.objects.columns) fail(`column count is ${columnCount}`);
if (functionDefinitions !== manifest.objects.functionOverloads.length) {
  fail(`function definition count is ${functionDefinitions}`);
}
if (standaloneIndexes !== manifest.objects.indexes.standalone) {
  fail(`standalone index count is ${standaloneIndexes}`);
}
if (policyCount !== manifest.objects.rls.publicPolicies + manifest.objects.rls.storageObjectPolicies) {
  fail(`policy count is ${policyCount}`);
}

const constraintCounts = constraintMatches.reduce((counts, match) => {
  const kind = {
    'PRIMARY KEY': 'primaryKey',
    'FOREIGN KEY': 'foreignKey',
    UNIQUE: 'unique',
    CHECK: 'check'
  }[match[1].toUpperCase()];
  counts[kind] = (counts[kind] ?? 0) + 1;
  return counts;
}, {});
for (const [kind, expected] of Object.entries(manifest.objects.constraints)) {
  if (constraintCounts[kind] !== expected) {
    fail(`${kind} constraint count is ${constraintCounts[kind]}, expected ${expected}`);
  }
}

for (const name of manifest.objects.rls.enabled) {
  if (!sql.includes(`alter table "public"."${name}" enable row level security;`)) {
    fail(`missing ENABLE ROW LEVEL SECURITY for ${name}`);
  }
}
for (const name of manifest.objects.rls.disabled) {
  if (!sql.includes(`alter table "public"."${name}" disable row level security;`)) {
    fail(`missing explicit DISABLE ROW LEVEL SECURITY for ${name}`);
  }
}
for (const name of manifest.objects.replicaIdentity.default) {
  if (!sql.includes(`alter table "public"."${name}" replica identity default;`)) {
    fail(`missing DEFAULT replica identity for ${name}`);
  }
}

const realtimeTables = matches(
  /alter publication supabase_realtime add table "public"\."([^"]+)";/gi
).map((match) => match[1]);
exact('supabase_realtime tables', realtimeTables, manifest.objects.realtimePublication.tables);

for (const bucket of manifest.objects.storageBuckets) {
  if (!sql.includes(`('${bucket.name}', '${bucket.name}', ${bucket.public}`)) {
    fail(`missing bucket configuration for ${bucket.name}`);
  }
}

for (const pattern of [
  /create\s+table\s+(?:"?(?:auth|storage)"?)\./i,
  /https?:\/\//i,
  /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i,
  /\b(?:password|service_role_key|secret_key)\b\s*[:=]/i,
  /create\s+extension[\s\S]*?\bversion\b/i,
  /CREATE TRIGGER (?:enforce_bucket_name_length_trigger|protect_buckets_delete|protect_objects_delete|update_objects_updated_at)\b/i
]) {
  if (pattern.test(sql)) fail(`forbidden content matched ${pattern}`);
}
for (const projectRef of stagingContract.productionProjectRefsDeniedForFixtureWrites) {
  if (sql.includes(projectRef)) fail('baseline contains a denied Production project ref');
}
if (/insert\s+into\s+(?:"?public"?\.)/i.test(outsideFunctions)) {
  fail('top-level application-row INSERT is forbidden');
}

const extensionNames = matches(/^create extension if not exists ([a-z0-9_-]+) with schema /gim)
  .map((match) => match[1]);
exact('application-required extensions', extensionNames, manifest.objects.extensions.included);
if (!sql.trimEnd().endsWith('commit;')) fail('migration must end with COMMIT');

console.log(JSON.stringify({
  migration: manifest.baselineMigration,
  tables: tableNames.length,
  views: viewNames.length,
  columns: columnCount,
  sequences: sequenceNames.length,
  constraints: constraintMatches.length,
  standaloneIndexes,
  functionOverloads: functionIdentities.length,
  triggers: triggerNames.length,
  policies: policyCount,
  realtimeTables: realtimeTables.length,
  storageBuckets: manifest.objects.storageBuckets.length,
  result: 'LOCALLY_PRODUCTION_BASELINE_STATIC_PASS'
}, null, 2));
