import { readFileSync } from 'node:fs';

import { PGlite } from '@electric-sql/pglite';
import { expect, test } from '@playwright/test';

const projectionPath = 'docs/migrations/v3_40_37_public_profiles_projection.sql';
const boundaryPath = 'docs/migrations/v3_40_38_profiles_authorization_boundary.sql';
const hostBarrierPath = 'supabase/migrations/20260929144521_harden_public_host_applications_security_barrier.sql';
const projectionSource = readFileSync(projectionPath, 'utf8');
const boundarySource = readFileSync(boundaryPath, 'utf8');
const hostBarrierSource = readFileSync(hostBarrierPath, 'utf8');
const normalizedProjection = projectionSource.replace(/\s+/g, ' ').trim();
const normalizedBoundary = boundarySource.replace(/\s+/g, ' ').trim();
const normalizedHostBarrier = hostBarrierSource.replace(/\s+/g, ' ').trim();

const publicConsumerPaths = [
  'app/account/page.tsx',
  'app/api/community/comments/route.ts',
  'app/api/guest/trips/route.ts',
  'app/community/boardFeed.server.ts',
  'app/community/detailData.server.ts',
  'app/community/legacyFeed.server.ts',
  'app/components/UserProfileModal.tsx',
  'app/experiences/[id]/page.tsx',
  'app/guest/inbox/page.tsx',
  'app/hooks/useChat.ts',
  'app/host/dashboard/HostReviews.tsx',
  'app/host/dashboard/components/ReservationManager.tsx',
];

test.describe('profiles privacy boundary', () => {
  test('adds an explicit privacy-safe public projection first', () => {
    expect(normalizedProjection.startsWith('-- v3.40.37')).toBe(true);
    expect(normalizedProjection).toContain('CREATE OR REPLACE VIEW public.public_profiles');
    expect(normalizedProjection).toContain('security_barrier = true');
    expect(normalizedProjection).toContain('security_invoker = false');
    expect(normalizedProjection).toContain('ALTER VIEW public.public_profiles OWNER TO postgres;');
    expect(normalizedProjection).toContain(
      'GRANT SELECT ON TABLE public.public_profiles TO anon, authenticated, service_role;'
    );

    const viewSelect = normalizedProjection.match(
      /CREATE OR REPLACE VIEW public\.public_profiles[\s\S]+? AS SELECT ([\s\S]+?) FROM public\.profiles;/
    )?.[1];
    expect(viewSelect).toBeTruthy();
    for (const sensitiveColumn of [
      'email',
      'phone',
      'kakao_id',
      'last_active_at',
      'bank_name',
      'account_number',
      'account_holder',
      'motivation',
      'dob',
    ]) {
      expect(viewSelect).not.toMatch(new RegExp(`\\b${sensitiveColumn}\\b`));
    }
  });

  test('atomically replaces only broad profile reads with self and admin reads', () => {
    expect(normalizedBoundary.startsWith('-- v3.40.38')).toBe(true);
    expect(normalizedBoundary).toMatch(/\bBEGIN;/i);
    expect(normalizedBoundary.endsWith('COMMIT;')).toBe(true);
    expect(normalizedBoundary).toContain(
      'DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;'
    );
    expect(normalizedBoundary).toContain(
      'DROP POLICY IF EXISTS "프로필은 누구나 조회 가능합니다" ON public.profiles;'
    );
    expect(normalizedBoundary).toContain(
      'CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);'
    );
    expect(normalizedBoundary).toContain(
      'CREATE POLICY profiles_select_admin ON public.profiles FOR SELECT TO authenticated USING (public.is_admin_reader());'
    );
    expect(normalizedBoundary).toContain(
      'REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM anon, authenticated;'
    );
    expect(normalizedBoundary).toContain(
      'GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;'
    );
  });

  test('fails closed on drift and preserves service-role and Realtime dependencies', () => {
    for (const assertion of [
      'Unexpected public.profiles drift.',
      'Required privacy-safe public.public_profiles view is missing or unsafe',
      'Preserved public.profiles write policies have unexpected definitions',
      'A broad public.profiles SELECT policy remains',
      'service_role public.profiles privileges changed unexpectedly',
      'public.profiles Realtime publication changed unexpectedly',
    ]) {
      expect(normalizedBoundary).toContain(assertion);
    }

    expect(normalizedBoundary).toContain("to_regprocedure('public.is_admin_reader()')");
    expect(normalizedBoundary).toContain(
      "has_table_privilege('service_role', 'public.profiles', 'SELECT')"
    );
    expect(normalizedBoundary).toContain("tablename = 'profiles'");
    expect(normalizedBoundary).toContain("pubname = 'supabase_realtime'");
  });

  test('moves cross-user browser and public server rendering to public_profiles', () => {
    for (const path of publicConsumerPaths) {
      const source = readFileSync(path, 'utf8');
      expect(source, path).toMatch(/\.from\(['"]public_profiles['"]\)/);
    }

    const modalSource = readFileSync('app/components/UserProfileModal.tsx', 'utf8');
    expect(modalSource).not.toMatch(/\.from\(['"]profiles['"]\)/);

    const chatSource = readFileSync('app/hooks/useChat.ts', 'utf8');
    expect(chatSource).not.toMatch(/\.from\(['"]profiles['"]\)/);
    expect(chatSource).not.toMatch(/select\(['"][^'"]*email/);

    const reviewSource = readFileSync('app/host/dashboard/HostReviews.tsx', 'utf8');
    expect(reviewSource).not.toContain('guest:profiles!reviews_user_id_fkey');

    const reservationSource = readFileSync(
      'app/host/dashboard/components/ReservationManager.tsx',
      'utf8'
    );
    expect(reservationSource).not.toContain('guest:profiles!bookings_user_id_fkey');
    expect(reservationSource).toContain('contact_phone');
    expect(reservationSource).toContain(".from('public_profiles')");
  });

  test('does not alter data, completed security boundaries, or host visibility projection', () => {
    for (const source of [projectionSource, boundarySource]) {
      expect(source).not.toMatch(/\bINSERT\s+INTO\b/i);
      expect(source).not.toMatch(/\bUPDATE\s+public\./i);
      expect(source).not.toMatch(/\bDELETE\s+FROM\b/i);
      expect(source).not.toMatch(/\bALTER\s+TABLE\b/i);
      expect(source).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/i);
      expect(source).not.toMatch(
        /(?:DROP|CREATE|ALTER)\s+(?:POLICY|TABLE|VIEW)[^;]*public\.(?:users|inquiries|inquiry_messages|public_host_applications)/i
      );
    }

    expect(boundarySource).toContain('Completed #2 users authorization boundary');
    expect(boundarySource).toContain('Completed #3/#4 inquiry authorization boundaries');
    expect(boundarySource).toContain("to_regclass('public.public_host_applications')");

    const homeRouteSource = readFileSync('app/api/home/experiences/route.ts', 'utf8');
    const homeSource = readFileSync('app/home/homeExperienceData.server.ts', 'utf8');
    const searchSource = readFileSync('app/api/search/experiences/route.ts', 'utf8');
    expect(homeRouteSource).toContain('getPublicHomeExperiences');
    expect(homeSource).toContain(".from('public_host_applications')");
    expect(searchSource).toContain('public_host_applications');
  });

  test('adds only a guarded security barrier to the public host view', () => {
    expect(normalizedHostBarrier).toMatch(/\bBEGIN;/);
    expect(normalizedHostBarrier.endsWith('COMMIT;')).toBe(true);
    expect(normalizedHostBarrier).toContain("view_options IS NOT DISTINCT FROM ARRAY['security_invoker=off']");
    expect(normalizedHostBarrier).toContain("view_options IS NOT DISTINCT FROM ARRAY['security_invoker=false']");
    expect(normalizedHostBarrier).toContain('approved/latest-row definition drifted');
    expect(normalizedHostBarrier).toContain('column contract drifted');
    expect(normalizedHostBarrier).toContain('grants drifted');
    expect(normalizedHostBarrier.match(/\bALTER VIEW\b[^;]+;/g)).toEqual([
      'ALTER VIEW public.public_host_applications SET (security_barrier = true);',
    ]);
    expect(normalizedHostBarrier).not.toContain('public.public_profiles');
    expect(normalizedHostBarrier).not.toMatch(/\b(?:CREATE OR REPLACE VIEW|DROP VIEW|GRANT SELECT|REVOKE ALL|security_invoker\s*=\s*true)\b/i);
  });

  test('preserves approved-row visibility and view metadata in isolated PostgreSQL', async () => {
    for (const invokerOption of ['off', 'false'] as const) {
      const db = new PGlite();
      try {
        await db.exec(`
          CREATE ROLE anon;
          CREATE ROLE authenticated;
          CREATE ROLE service_role BYPASSRLS;
          CREATE TABLE public.host_applications (
            id uuid PRIMARY KEY, user_id uuid NOT NULL, status text NOT NULL,
            name text, profile_photo text, languages text[], self_intro text,
            created_at timestamptz NOT NULL, is_superhost boolean NOT NULL DEFAULT false,
            phone text
          );
          INSERT INTO public.host_applications (id, user_id, status, name, created_at) VALUES
            ('00000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'approved', 'Synthetic A', '2026-09-01'),
            ('00000000-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'approved', 'Synthetic B', '2026-09-01'),
            ('00000000-0000-4000-8000-000000000003', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'pending', 'Synthetic B', '2026-09-02');
          CREATE VIEW public.public_host_applications WITH (security_invoker=${invokerOption}) AS
            WITH latest_per_user AS (
              SELECT DISTINCT ON (user_id)
                id, user_id, status, name, profile_photo, languages, self_intro, created_at, is_superhost
              FROM public.host_applications
              ORDER BY user_id, created_at DESC, id DESC
            )
            SELECT id, user_id, status, name, profile_photo, languages, self_intro, created_at, is_superhost
            FROM latest_per_user WHERE status = 'approved'::text;
          GRANT SELECT ON public.public_host_applications TO anon, authenticated, service_role;
          CREATE TABLE public.profiles (id uuid, full_name text);
          CREATE VIEW public.public_profiles WITH (security_barrier=true, security_invoker=false)
            AS SELECT id, full_name FROM public.profiles;
        `);

        const metadata = async (name: string) => (await db.query<{
          definition: string;
          owner: string;
          options: string[];
          grants: string;
          columns: string[];
        }>(`
          SELECT pg_get_viewdef(relation.oid, true) AS definition,
                 pg_get_userbyid(relation.relowner) AS owner,
                 relation.reloptions AS options,
                 relation.relacl::text AS grants,
                 (SELECT array_agg(attribute.attname || ':' || format_type(attribute.atttypid, attribute.atttypmod)
                                   ORDER BY attribute.attnum)
                    FROM pg_attribute AS attribute
                   WHERE attribute.attrelid = relation.oid
                     AND attribute.attnum > 0 AND NOT attribute.attisdropped) AS columns
            FROM pg_class AS relation WHERE relation.oid = $1::regclass
        `, [name])).rows[0];
        const visibleRows = async () => (await db.query(
          'SELECT user_id, status FROM public.public_host_applications ORDER BY user_id'
        )).rows;

        const before = await metadata('public.public_host_applications');
        const profileBefore = await metadata('public.public_profiles');
        const rowsBefore = await visibleRows();
        expect(rowsBefore).toHaveLength(1);
        expect(rowsBefore[0]).toMatchObject({ status: 'approved' });

        await db.exec(hostBarrierSource);

        const after = await metadata('public.public_host_applications');
        expect(after).toMatchObject({
          definition: before.definition,
          owner: before.owner,
          grants: before.grants,
          columns: before.columns,
        });
        expect(after.options).toEqual(expect.arrayContaining([
          `security_invoker=${invokerOption}`, 'security_barrier=true',
        ]));
        expect(await metadata('public.public_profiles')).toEqual(profileBefore);
        expect(await visibleRows()).toEqual(rowsBefore);

        for (const role of ['anon', 'authenticated']) {
          await db.exec(`SET ROLE ${role};`);
          expect(await visibleRows()).toEqual(rowsBefore);
          await db.exec('RESET ROLE;');
        }
      } finally {
        await db.close();
      }
    }
  });
});
