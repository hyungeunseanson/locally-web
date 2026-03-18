import { readFileSync } from 'fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

type EnvMap = Record<string, string>;
type PublicExperience = {
  id: number;
  title: string;
  city: string | null;
  duration: number;
};

let adminClient: SupabaseClient | null = null;

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

function formatDurationLabel(duration: number) {
  return Number.isInteger(duration) ? String(duration) : duration.toString();
}

function getDurationPattern(duration: number) {
  const hours = formatDurationLabel(duration).replace('.', '\\.');
  return new RegExp(`${hours}\\s?(hours?|시간|時間|小时)`);
}

async function getPublicExperienceFixture(): Promise<PublicExperience> {
  const supabase = getAdminClient();
  const { data: approvedHosts, error: approvedHostsError } = await supabase
    .from('public_host_applications')
    .select('user_id')
    .eq('status', 'approved');

  if (approvedHostsError) throw approvedHostsError;

  const approvedHostIds = (approvedHosts ?? [])
    .map((host) => String(host.user_id || ''))
    .filter(Boolean);

  if (approvedHostIds.length === 0) {
    throw new Error('No approved hosts found for guest ingress smoke.');
  }

  const { data, error } = await supabase
    .from('experiences')
    .select('id, title, city, duration')
    .eq('status', 'active')
    .in('host_id', approvedHostIds)
    .gt('duration', 0)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id || !data?.title || typeof data.duration !== 'number') {
    throw new Error('No active public experience with duration found for guest ingress smoke.');
  }

  return {
    id: Number(data.id),
    title: String(data.title),
    city: data.city ? String(data.city) : null,
    duration: Number(data.duration),
  };
}

test.describe.serial('Guest search/detail ingress smoke', () => {
  test('filters on home and opens the matching experience detail', async ({ page }) => {
    const experience = await getPublicExperienceFixture();
    const durationPattern = getDurationPattern(experience.duration);

    await page.goto('/', { waitUntil: 'networkidle' });

    const homeSearchInput = page.locator('input[type="text"]').first();
    await expect(homeSearchInput).toBeVisible({ timeout: 15000 });
    await homeSearchInput.fill(experience.title);
    await homeSearchInput.press('Enter');

    const experienceLink = page.locator(`a[href="/experiences/${experience.id}"]:visible`).first();
    await expect(experienceLink).toBeVisible({ timeout: 15000 });
    await expect(experienceLink.getByTestId('experience-card-duration')).toHaveText(durationPattern);
    await experienceLink.click();

    await page.waitForURL(new RegExp(`/experiences/${experience.id}$`), { timeout: 15000 });
    await expect(page.locator('h1:visible').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('experience-duration-meta-desktop')).toContainText(durationPattern);

    const durationFacts = page.getByTestId('experience-duration-facts');
    await expect(durationFacts).toBeVisible();
    await expect(durationFacts).toContainText(durationPattern);
  });

  test('opens the same experience detail from search results', async ({ page }) => {
    const experience = await getPublicExperienceFixture();
    const durationPattern = getDurationPattern(experience.duration);

    await page.goto(`/search?location=${encodeURIComponent(experience.title)}`, {
      waitUntil: 'networkidle',
    });

    const experienceLink = page.locator(`a[href="/experiences/${experience.id}"]:visible`).first();
    await expect(experienceLink).toBeVisible({ timeout: 15000 });

    await experienceLink.click();

    await page.waitForURL(new RegExp(`/experiences/${experience.id}$`), { timeout: 15000 });
    await expect(page.locator('h1:visible').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('experience-duration-meta-desktop')).toContainText(durationPattern);
  });
});
