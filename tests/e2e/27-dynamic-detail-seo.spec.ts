import { readFileSync } from 'fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

type EnvMap = Record<string, string>;
type TestUser = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
};

const TEST_PASSWORD = 'LocallyTest!2026';
const ADSENSE_RUNTIME_CONFIGURED =
  process.env.NEXT_PUBLIC_ADSENSE_ENABLED === 'true'
  && /^ca-pub-\d+$/.test(process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || '')
  && /^\d+$/.test(process.env.NEXT_PUBLIC_ADSENSE_DESKTOP_FOOTER_SLOT || '');

let adminClient: SupabaseClient | null = null;
const createdAuthUserIds: string[] = [];
const createdApplicationIds: string[] = [];
const createdExperienceIds: number[] = [];
const createdServiceRequestIds: string[] = [];
const createdCommunityPostIds: string[] = [];

function loadEnv(): EnvMap {
  return readFileSync('.env.local', 'utf8')
    .split(/\n/)
    .reduce<EnvMap>((acc, line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) acc[match[1]] = match[2];
      return acc;
    }, {});
}

function getAdminClient() {
  if (adminClient) return adminClient;

  const env = loadEnv();
  adminClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  return adminClient;
}

async function waitForProfile(userId: string) {
  const supabase = getAdminClient();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) return;

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Profile was not created for auth user ${userId}.`);
}

function createUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.dynamic.seo.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Dynamic SEO ${prefix} ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

async function createAuthUser(user: TestUser) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      full_name: user.fullName,
      phone: user.phone,
    },
  });

  if (error || !data.user?.id) {
    throw error || new Error(`Failed to create auth user for ${user.email}`);
  }

  createdAuthUserIds.push(data.user.id);
  await waitForProfile(data.user.id);

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: user.fullName,
      phone: user.phone,
    })
    .eq('id', data.user.id);

  if (profileError) throw profileError;

  return { id: data.user.id, ...user };
}

async function createCustomerUser() {
  return createAuthUser(createUser('customer'));
}

async function login(page: import('@playwright/test').Page, user: TestUser) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
}

async function createVisibleHostUser() {
  const host = await createAuthUser(createUser('host'));

  const { data, error } = await getAdminClient()
    .from('host_applications')
    .insert({
      user_id: host.id,
      host_nationality: '대한민국',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      name: host.fullName,
      phone: host.phone,
      dob: '1991-03-14',
      email: host.email,
      instagram: '@codex_dynamic_seo_host',
      source: 'playwright',
      language_cert: '',
      profile_photo: '/images/logo.png',
      self_intro: '동적 SEO 회귀 테스트용 공개 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: host.fullName,
      motivation: '동적 SEO 회귀 테스트',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create visible host application.');
  }

  createdApplicationIds.push(String(data.id));
  return host.id;
}

async function createExperienceFixture(hostId: string, status: 'active' | 'inactive') {
  const supabase = getAdminClient();
  const title = `[Playwright] SEO Experience ${status} ${Date.now()}`;

  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: 'Seoul',
      title,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: `${status} SEO metadata verification experience`,
      itinerary: [{ title: 'SEO 테스트 코스', description: '검색엔진 메타 검증용 코스입니다.' }],
      spots: 'SEO TEST SPOT',
      meeting_point: 'SEO TEST STATION',
      location: 'Seoul SEO Test Location',
      photos: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'],
      price: 55000,
      inclusions: ['가이드'],
      exclusions: ['개인 경비'],
      supplies: '편한 복장',
      rules: {
        age_limit: '만 19세 이상',
        activity_level: '보통',
      },
      status,
      is_active: status === 'active',
      is_private_enabled: false,
      private_price: 0,
      source_locale: 'ko',
      manual_locales: ['ko'],
      translation_version: 1,
      translation_meta: {},
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error(`Failed to create ${status} experience.`);
  }

  createdExperienceIds.push(data.id);

  return { id: Number(data.id), title };
}

async function createOpenServiceRequestFixture(customer: { id: string; fullName: string; phone: string }) {
  const supabase = getAdminClient();
  const timestamp = Date.now();
  const serviceDate = new Date();
  serviceDate.setDate(serviceDate.getDate() + 10);

  const { data, error } = await supabase
    .from('service_requests')
    .insert({
      user_id: customer.id,
      title: `[Playwright] SEO Service Request ${timestamp}`,
      description: '검색엔진 noindex 검증용 오픈 서비스 의뢰입니다.',
      city: 'Seoul',
      country: 'KR',
      service_date: serviceDate.toISOString().slice(0, 10),
      start_time: '10:00',
      duration_hours: 4,
      languages: ['한국어'],
      guest_count: 2,
      contact_name: customer.fullName,
      contact_phone: customer.phone,
      status: 'open',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create open service request.');
  }

  createdServiceRequestIds.push(data.id);

  return { id: data.id };
}

async function createCommunityPostFixture(authorId: string, indexable: boolean) {
  const title = `[Playwright] SEO Community ${indexable ? 'public' : 'noindex'} ${Date.now()}`;
  const basePayload = {
    user_id: authorId,
    category: 'qna',
    post_format: 'question',
    source_locale: 'ko',
    title,
    content: `${title} 내용입니다.`,
    images: [],
    linked_exp_id: null,
  };
  const { data, error } = await getAdminClient()
    .from('community_posts')
    .insert({
      ...basePayload,
      board_country: indexable ? 'japan' : null,
      destination_hub: null,
    })
    .select('id')
    .single();

  if (!error && data?.id) {
    createdCommunityPostIds.push(String(data.id));
    return { id: String(data.id), title };
  }

  const fallback = await getAdminClient()
    .from('community_posts')
    .insert({
      ...basePayload,
      destination_hub: indexable ? 'tokyo' : null,
    })
    .select('id')
    .single();

  if (fallback.error || !fallback.data?.id) {
    throw fallback.error || error
      || new Error(`Failed to create ${indexable ? 'public' : 'noindex'} community fixture.`);
  }

  createdCommunityPostIds.push(String(fallback.data.id));
  return { id: String(fallback.data.id), title };
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdCommunityPostIds.length > 0) {
    await supabase.from('community_posts').delete().in('id', createdCommunityPostIds);
  }

  if (createdServiceRequestIds.length > 0) {
    await supabase.from('service_requests').delete().in('id', createdServiceRequestIds);
  }

  if (createdExperienceIds.length > 0) {
    await supabase.from('experiences').delete().in('id', createdExperienceIds);
  }

  if (createdApplicationIds.length > 0) {
    await supabase.from('host_applications').delete().in('id', createdApplicationIds);
  }

  for (const userId of createdAuthUserIds.reverse()) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe('Dynamic detail SEO boundaries', () => {
  test.beforeEach(async ({ page }) => {
    if (!ADSENSE_RUNTIME_CONFIGURED) return;
    await page.route('https://pagead2.googlesyndication.com/**', async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: 'window.adsbygoogle = window.adsbygoogle || [];',
      });
    });
  });

  test('keeps active experiences indexable and marks private-like detail pages as noindex', async ({ page }) => {
    const customer = await createCustomerUser();
    const visibleHostId = await createVisibleHostUser();
    const activeExperience = await createExperienceFixture(visibleHostId, 'active');
    const inactiveExperience = await createExperienceFixture(visibleHostId, 'inactive');
    const serviceRequest = await createOpenServiceRequestFixture(customer);
    const publicCommunityPost = await createCommunityPostFixture(customer.id, true);
    const noindexCommunityPost = await createCommunityPostFixture(customer.id, false);

    await page.goto(`/experiences/${activeExperience.id}`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: activeExperience.title, exact: true })).toBeVisible({
      timeout: 15000,
    });
    const activeCanonical = page.locator('link[rel="canonical"]');
    await expect(activeCanonical).toHaveAttribute('href', new RegExp(`/experiences/${activeExperience.id}$`));
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    await expect(page.locator('meta[name="locally-adsense-public-path"]'))
      .toHaveAttribute('content', `/experiences/${activeExperience.id}`);
    if (ADSENSE_RUNTIME_CONFIGURED) {
      await expect(page.getByTestId('desktop-footer-ad')).toHaveCount(1);
      await expect(page.locator('ins.adsbygoogle')).toHaveCount(1);
    }

    await page.goto(`/users/${visibleHostId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('meta[name="locally-adsense-public-path"]'))
      .toHaveAttribute('content', `/users/${visibleHostId}`);
    if (ADSENSE_RUNTIME_CONFIGURED) {
      await expect(page.getByTestId('desktop-footer-ad')).toHaveCount(1);
    }

    await page.goto(`/experiences/${inactiveExperience.id}`, { waitUntil: 'domcontentloaded' });

    const inactiveRobots = page.locator('meta[name="robots"]');
    await expect(inactiveRobots).toHaveAttribute('content', /noindex/i);
    await expect(page.locator('meta[name="locally-adsense-public-path"]')).toHaveCount(0);
    if (ADSENSE_RUNTIME_CONFIGURED) {
      await expect(page.getByTestId('desktop-footer-ad')).toHaveCount(0);
      await expect(page.locator('ins.adsbygoogle')).toHaveCount(0);
    }

    await page.goto(`/community/${publicCommunityPost.id}?board=japan`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: publicCommunityPost.title })).toBeVisible();
    await expect(page.locator('meta[name="locally-adsense-public-path"]'))
      .toHaveAttribute('content', `/community/${publicCommunityPost.id}`);
    if (ADSENSE_RUNTIME_CONFIGURED) {
      await expect(page.getByTestId('desktop-footer-ad')).toHaveCount(1);
    }

    await page.goto(`/community/${noindexCommunityPost.id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/i);
    await expect(page.locator('meta[name="locally-adsense-public-path"]')).toHaveCount(0);
    if (ADSENSE_RUNTIME_CONFIGURED) {
      await expect(page.getByTestId('desktop-footer-ad')).toHaveCount(0);
      await expect(page.locator('ins.adsbygoogle')).toHaveCount(0);
    }

    await page.goto(`/services/${serviceRequest.id}`, { waitUntil: 'domcontentloaded' });

    const serviceRobots = page.locator('meta[name="robots"]');
    await expect(serviceRobots).toHaveAttribute('content', /noindex/i);
    if (ADSENSE_RUNTIME_CONFIGURED) {
      await expect(page.getByTestId('desktop-footer-ad')).toHaveCount(0);
      await expect(page.locator('ins.adsbygoogle')).toHaveCount(0);
    }

    if (ADSENSE_RUNTIME_CONFIGURED) {
      await page.addInitScript(() => {
        class AlwaysOutsideViewportIntersectionObserver {
          readonly root = null;
          readonly rootMargin = '0px';
          readonly thresholds = [0];

          constructor(
            private readonly callback: IntersectionObserverCallback
          ) {}

          disconnect() {}
          unobserve() {}
          takeRecords() { return []; }
          observe(target: Element) {
            this.callback([{
              boundingClientRect: target.getBoundingClientRect(),
              intersectionRatio: 0,
              intersectionRect: new DOMRectReadOnly(),
              isIntersecting: false,
              rootBounds: null,
              target,
              time: performance.now(),
            }], this as unknown as IntersectionObserver);
          }
        }

        window.IntersectionObserver = (
          AlwaysOutsideViewportIntersectionObserver as unknown as typeof IntersectionObserver
        );
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/experiences/${activeExperience.id}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('desktop-footer-ad')).toHaveCount(1);
      await expect(page.getByTestId('experience-mobile-sticky-action')).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

      for (const testId of [
        'experience-mobile-sticky-action',
        'mobile-bottom-tab',
        'global-support-report-trigger',
      ]) {
        const gap = await page.evaluate((controlTestId) => {
          const ad = document.querySelector<HTMLElement>(
            '[data-testid="desktop-footer-ad"] ins.adsbygoogle'
          );
          const control = document.querySelector<HTMLElement>(`[data-testid="${controlTestId}"]`);
          if (!ad || !control) return null;
          return control.getBoundingClientRect().top - ad.getBoundingClientRect().bottom;
        }, testId);
        expect(gap, `experience mobile gap before ${testId}`).not.toBeNull();
        expect(gap as number, `experience mobile gap before ${testId}`).toBeGreaterThanOrEqual(12);
      }

      await login(page, customer);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/community', { waitUntil: 'networkidle' });
      await expect(page.getByTestId('community-write-cta-mobile')).toBeVisible();
      await expect(page.getByTestId('desktop-footer-ad')).toHaveCount(1);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

      for (const testId of [
        'community-write-cta-mobile',
        'mobile-bottom-tab',
        'global-support-report-trigger',
      ]) {
        const gap = await page.evaluate((controlTestId) => {
          const ad = document.querySelector<HTMLElement>(
            '[data-testid="desktop-footer-ad"] ins.adsbygoogle'
          );
          const control = document.querySelector<HTMLElement>(`[data-testid="${controlTestId}"]`);
          if (!ad || !control) return null;
          return control.getBoundingClientRect().top - ad.getBoundingClientRect().bottom;
        }, testId);
        expect(gap, `community mobile gap before ${testId}`).not.toBeNull();
        expect(gap as number, `community mobile gap before ${testId}`).toBeGreaterThanOrEqual(12);
      }
      expect(await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      )).toBeFalsy();
    }
  });
});
