import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

const pageSource = readFileSync('app/experiences/[id]/page.tsx', 'utf8');
const cacheSource = readFileSync(
  'app/experiences/[id]/publicDetailData.server.ts',
  'utf8'
);
const clientSource = readFileSync('app/experiences/[id]/ExperienceClient.tsx', 'utf8');
const paymentSource = readFileSync('app/experiences/[id]/payment/page.tsx', 'utf8');

test.describe('experience detail public cache contract', () => {
  test('caches only locale-neutral public view data with a bounded TTL', () => {
    expect(cacheSource).toContain("import { unstable_cache } from 'next/cache'");
    expect(cacheSource).toContain('PUBLIC_EXPERIENCE_DETAIL_REVALIDATE_SECONDS = 60');
    expect(cacheSource).toContain("['public-experience-detail', id]");
    expect(cacheSource).toContain('`public-experience-detail-${id}`');
    expect(cacheSource).toContain('isPublicExperienceViewModel(experience)');
    expect(cacheSource).toContain('isPublicHostApplicationStatus(publicHostApplication.status)');
    expect(cacheSource).toContain('createPublicServerClient()');

    for (const localizedColumn of [
      'title_ko',
      'title_en',
      'title_ja',
      'title_zh',
      'description_ko',
      'description_en',
      'description_ja',
      'description_zh',
    ]) {
      expect(cacheSource).toContain(`'${localizedColumn}'`);
    }

    expect(cacheSource).not.toContain('getCurrentLocale');
    expect(cacheSource).not.toContain('cookies(');
    expect(cacheSource).not.toContain('headers(');
    expect(cacheSource).not.toContain('createAdminClient');
    expect(cacheSource).not.toContain(".from('host_applications')");
    expect(cacheSource).not.toContain('bookings');
    expect(cacheSource).not.toContain('experience_availability');
  });

  test('deduplicates metadata and page public reads without caching locale selection', () => {
    expect(cacheSource).toContain("import { cache } from 'react'");
    expect(cacheSource).toContain('cache(loadPublicExperienceDetail)');
    expect(pageSource.match(/getPublicExperienceDetail\(id\)/g)).toHaveLength(2);
    expect(pageSource).toContain('const locale = await getCurrentLocale()');
    expect(pageSource).toContain("getContent(normalizedExperience, 'title', locale)");
    expect(pageSource).toContain("getContent(experience, 'title', locale)");
    expect(pageSource).toContain("ko: '홈'");
    expect(pageSource).toContain("en: 'Home'");
    expect(pageSource).toContain("ja: 'ホーム'");
    expect(pageSource).toContain("zh: '首页'");
  });

  test('keeps availability, private fallback, auth, and payment authority dynamic', () => {
    expect(pageSource).toContain("export const dynamic = 'force-dynamic'");
    expect(pageSource).toContain('fetchExperienceAvailabilitySummary(');
    expect(pageSource).toContain('createAdminClient()');
    expect(pageSource).toContain('publicSnapshot ? null : await createClient()');
    expect(pageSource).toContain(".from('host_applications')");

    expect(clientSource).toContain(`/api/experiences/${'${experienceId}'}/availability-summary`);
    expect(clientSource).toContain("cache: 'no-store'");
    expect(clientSource).toContain('useAuth()');
    expect(clientSource).toContain('useWishlist(experienceId)');

    expect(paymentSource).toContain(".from('experiences')");
    expect(paymentSource).toContain(
      ".select('title, image_url, photos, location, price, private_price, max_guests, host_id, solo_guarantee_price, solo_guarantee_option_visible, rules, rules_i18n')"
    );
  });

  test('keeps R2 image components outside the Vercel optimizer path', () => {
    expect(clientSource).toContain('PublicExperienceDetailImage');
    expect(clientSource).toContain('PublicHostProfileImage');
    expect(pageSource).not.toContain("from 'next/image'");
  });
});
