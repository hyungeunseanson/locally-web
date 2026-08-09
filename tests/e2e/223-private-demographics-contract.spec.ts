import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test.describe('Private profile demographics contract', () => {
  test('keeps exact demographics service-role only and removes legacy public columns in cleanup', () => {
    const migration = read('docs/migrations/v3_40_31_private_profile_demographics.sql');
    const reminder = read('docs/migrations/v3_40_33_profile_demographics_reminder.sql');
    const cleanup = read('docs/migrations/v3_40_34_drop_public_profile_demographics.sql');

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.profile_private_demographics');
    expect(migration).toContain('REVOKE ALL ON TABLE public.profile_private_demographics FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('GRANT ALL ON TABLE public.profile_private_demographics TO service_role');
    expect(migration).toContain('LEFT JOIN public.profiles AS p ON p.id = u.id');
    expect(migration).toContain('CREATE TRIGGER sync_profile_private_demographics');
    expect(cleanup).toContain('DROP TRIGGER IF EXISTS sync_profile_private_demographics');
    expect(cleanup).toContain('CREATE OR REPLACE FUNCTION public.handle_new_user()');
    expect(cleanup).not.toContain('nationality, birth_date, gender');
    expect(reminder).toContain("WHERE type = 'profile_demographics_required'");
    expect(cleanup).toContain('DROP COLUMN IF EXISTS birth_date');
    expect(cleanup).toContain('DROP COLUMN IF EXISTS gender');
  });

  test('uses the authenticated session identity for the own-demographics API', () => {
    const route = read('app/api/account/demographics/route.ts');

    expect(route).toContain('supabase.auth.getUser()');
    expect(route).toContain(".eq('user_id', user.id)");
    expect(route).not.toContain('body.user_id');
    expect(route).not.toContain('body.userId');
    expect(route).toContain('isValidBirthDate');
    expect(route).toContain('isDemographicGender');
  });

  test('fails direct booking writes with the stable 422 demographics contract', () => {
    const route = read('app/api/bookings/route.ts');
    const serverReader = read('app/utils/demographicsServer.ts');

    expect(route).toContain('readPrivateDemographics(supabaseAdmin, user.id)');
    expect(serverReader).toContain(".from('profile_private_demographics')");
    expect(route).toContain("'profile_demographics_required'");
    expect(route).toContain("{ code: 'PROFILE_DEMOGRAPHICS_REQUIRED', missingFields: missingDemographicFields }");
    expect(route).toContain('422');
  });

  test('does not fetch or render gender on the public profile modal', () => {
    const modal = read('app/components/UserProfileModal.tsx');

    expect(modal).not.toContain(".select('*')");
    expect(modal).not.toContain('formatGenderLabel');
    expect(modal).not.toContain('displayProfile?.gender');
  });

  test('preserves OAuth return navigation when reminder delivery fails', () => {
    const callback = read('app/auth/callback/route.ts');

    expect(callback).toContain('await ensureDemographicsReminder(userId)');
    expect(callback).toContain("console.warn('[auth/callback] demographics reminder delivery failed')");
    expect(callback).toContain('NextResponse.redirect(`${redirectOrigin}${next}`)');
  });

  test('exposes only booking snapshots to the host reservation client', () => {
    const reservations = read('app/host/dashboard/components/ReservationManager.tsx');
    const guestModal = read('app/host/dashboard/components/GuestProfileModal.tsx');

    expect(reservations).toContain('guest_age_band');
    expect(reservations).toContain('guest_gender');
    expect(reservations).not.toContain('birth_date');
    expect(guestModal).toContain('formatDemographicGender(guest.gender, lang)');
    expect(guestModal).toContain("lang === 'ja'");
    expect(guestModal).toContain("lang === 'zh'");
  });
});
