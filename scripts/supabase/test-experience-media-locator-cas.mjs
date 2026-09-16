import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { PGlite } from '@electric-sql/pglite';

const FUNCTION_SIGNATURE = 'public.apply_experience_media_locator_cas(bigint,text[],text,jsonb,jsonb,text[],text,jsonb,jsonb)';
const migrationPath = 'supabase/migrations/20260916020911_experience_media_locator_cas.sql';
const db = new PGlite();

const state = ({
  photos = ['legacy-a', 'legacy-b'],
  imageUrl = 'legacy-a',
  itinerary = [{ day: 1, image_url: 'legacy-a', note: 'preserve' }],
  itineraryI18n = { en: [{ day: 1, image_url: 'legacy-a', note: 'preserve' }] },
} = {}) => ({ photos, imageUrl, itinerary, itineraryI18n });

async function callCas(role, id, before, after) {
  await db.exec('BEGIN');
  try {
    await db.exec(`SET LOCAL ROLE ${role}`);
    const result = await db.query(`
      SELECT public.apply_experience_media_locator_cas(
        $1::bigint, $2::text[], $3::text, $4::jsonb, $5::jsonb,
        $6::text[], $7::text, $8::jsonb, $9::jsonb
      ) AS outcome
    `, [
      id,
      before.photos,
      before.imageUrl,
      before.itinerary,
      before.itineraryI18n,
      after.photos,
      after.imageUrl,
      after.itinerary,
      after.itineraryI18n,
    ]);
    await db.exec('COMMIT');
    return result.rows[0].outcome;
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}

await db.exec(`
  CREATE ROLE anon;
  CREATE ROLE authenticated;
  CREATE ROLE service_role BYPASSRLS;
  CREATE TABLE public.experiences (
    id bigint PRIMARY KEY,
    photos text[],
    image_url text,
    itinerary jsonb,
    itinerary_i18n jsonb,
    title text NOT NULL,
    status text NOT NULL
  );
  ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  GRANT SELECT, UPDATE ON public.experiences TO service_role;
`);
const migration = await readFile(migrationPath, 'utf8');
assert.match(migration, /SECURITY INVOKER/i);
assert.match(migration, /SET search_path = ''/i);
assert.doesNotMatch(migration, /SECURITY DEFINER/i);
assert.doesNotMatch(migration, /\b(?:CREATE|ALTER)\s+TABLE\b|\bCREATE\s+TRIGGER\b|\bCREATE\s+POLICY\b/i);
assert.equal((migration.match(/\bCREATE\s+FUNCTION\b/gi) || []).length, 1);
await db.exec(migration);

for (const role of ['PUBLIC', 'anon', 'authenticated', 'service_role']) {
  const grantee = role === 'PUBLIC' ? 'public' : role;
  const allowed = (await db.query(
    `SELECT has_function_privilege($1, $2, 'EXECUTE') AS allowed`,
    [grantee, FUNCTION_SIGNATURE]
  )).rows[0].allowed;
  assert.equal(allowed, role === 'service_role', `${role} execute ACL mismatch`);
}

const functionContract = (await db.query(`
  SELECT
    procedure.prosecdef AS security_definer,
    procedure.proconfig AS settings,
    pg_get_userbyid(procedure.proowner) AS owner
  FROM pg_proc AS procedure
  JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'public'
    AND procedure.proname = 'apply_experience_media_locator_cas'
`)).rows[0];
assert.equal(functionContract.security_definer, false);
assert.deepEqual(functionContract.settings, ['search_path=""']);
assert.equal(functionContract.owner, 'postgres');

const before = state();
const after = state({
  photos: ['r2-a', 'r2-b'],
  imageUrl: 'r2-a',
  itinerary: [{ day: 1, image_url: 'r2-a', note: 'preserve' }],
  itineraryI18n: { en: [{ day: 1, image_url: 'r2-a', note: 'preserve' }] },
});
await db.query(`INSERT INTO public.experiences VALUES (1, $1, $2, $3, $4, 'unchanged title', 'active')`, [
  before.photos, before.imageUrl, before.itinerary, before.itineraryI18n,
]);
assert.equal(await callCas('service_role', 1, before, after), 'updated');
assert.equal(await callCas('service_role', 1, before, after), 'already_exact');
const row = (await db.query(`SELECT * FROM public.experiences WHERE id = 1`)).rows[0];
assert.deepEqual(row.photos, after.photos);
assert.equal(row.image_url, after.imageUrl);
assert.deepEqual(row.itinerary, after.itinerary);
assert.deepEqual(row.itinerary_i18n, after.itineraryI18n);
assert.equal(row.title, 'unchanged title');
assert.equal(row.status, 'active');

const staleBefore = structuredClone(before);
staleBefore.itinerary = [{ day: 1, image_url: 'different' }];
assert.equal(await callCas('service_role', 1, staleBefore, state({ photos: ['other'] })), 'conflict');

const largeBefore = state({
  photos: ['large-before'],
  imageUrl: null,
  itinerary: null,
  itineraryI18n: { en: [{ description: 'x'.repeat(96_000) }] },
});
const largeAfter = state({
  photos: ['large-after'],
  imageUrl: null,
  itinerary: null,
  itineraryI18n: { en: [{ description: 'y'.repeat(96_000) }] },
});
await db.query(`INSERT INTO public.experiences VALUES (2, $1, $2, $3, $4, 'large', 'active')`, [
  largeBefore.photos, largeBefore.imageUrl, largeBefore.itinerary, largeBefore.itineraryI18n,
]);
assert.equal(await callCas('service_role', 2, largeBefore, largeAfter), 'updated');

const nullBefore = state({ photos: null, imageUrl: null, itinerary: null, itineraryI18n: null });
const nullAfter = state({ photos: ['only'], imageUrl: 'only', itinerary: [], itineraryI18n: {} });
await db.query(`INSERT INTO public.experiences VALUES (3, NULL, NULL, NULL, NULL, 'nulls', 'pending')`);
assert.equal(await callCas('service_role', 3, nullBefore, nullAfter), 'updated');

const ordered = state({ photos: ['one', 'two'] });
await db.query(`INSERT INTO public.experiences VALUES (4, $1, $2, $3, $4, 'ordered', 'active')`, [
  ordered.photos, ordered.imageUrl, ordered.itinerary, ordered.itineraryI18n,
]);
assert.equal(
  await callCas('service_role', 4, state({ photos: ['two', 'one'] }), state({ photos: ['r2-one', 'r2-two'] })),
  'conflict'
);
assert.equal(await callCas('service_role', 999, before, after), 'not_found');

await assert.rejects(() => callCas('anon', 1, after, after), /permission denied for function/i);
await assert.rejects(() => callCas('authenticated', 1, after, after), /permission denied for function/i);

const raceBefore = state({ photos: ['race-before'] });
const raceAfterA = state({ photos: ['race-a'], imageUrl: 'race-a' });
const raceAfterB = state({ photos: ['race-b'], imageUrl: 'race-b' });
await db.query(`INSERT INTO public.experiences VALUES (5, $1, $2, $3, $4, 'race', 'active')`, [
  raceBefore.photos, raceBefore.imageUrl, raceBefore.itinerary, raceBefore.itineraryI18n,
]);
const raceOutcomes = await Promise.all([
  callCas('service_role', 5, raceBefore, raceAfterA),
  callCas('service_role', 5, raceBefore, raceAfterB),
]);
assert.deepEqual(raceOutcomes.sort(), ['conflict', 'updated']);

console.log(JSON.stringify({
  result: 'EXPERIENCE_MEDIA_LOCATOR_CAS_POSTGRES_PASS',
  cases: [
    'updated', 'already_exact', 'conflict', 'large_jsonb', 'null_safe',
    'photo_order', 'not_found', 'role_acl', 'non_media_preserved', 'race',
  ],
  security: { invoker: true, searchPath: '', serviceRoleOnly: true },
}, null, 2));

await db.close();
