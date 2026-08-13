import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

const projectionPath = 'docs/migrations/v3_40_37_public_profiles_projection.sql';
const boundaryPath = 'docs/migrations/v3_40_38_profiles_authorization_boundary.sql';
const projectionSource = readFileSync(projectionPath, 'utf8');
const boundarySource = readFileSync(boundaryPath, 'utf8');
const normalizedProjection = projectionSource.replace(/\s+/g, ' ').trim();
const normalizedBoundary = boundarySource.replace(/\s+/g, ' ').trim();

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

    const homeSource = readFileSync('app/api/home/experiences/route.ts', 'utf8');
    const searchSource = readFileSync('app/api/search/experiences/route.ts', 'utf8');
    expect(homeSource).toContain('public_host_applications');
    expect(searchSource).toContain('public_host_applications');
  });
});
