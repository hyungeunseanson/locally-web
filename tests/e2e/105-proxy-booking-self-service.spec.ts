import { readFileSync } from 'fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

type EnvMap = Record<string, string>;
type TestUser = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
};

const TEST_PASSWORD = 'LocallyTest!2026';

let adminClient: SupabaseClient | null = null;
const createdAuthUserIds: string[] = [];
const createdProxyRequestIds: string[] = [];

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

function createUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.proxy.selfservice.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Proxy Self Service ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
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
      email: user.email,
    })
    .eq('id', data.user.id);

  if (profileError) throw profileError;

  return data.user.id;
}

async function createProxyRequest(userId: string, user: TestUser) {
  const linkedInquiryId = Number(String(Date.now()).slice(-9));

  const { data, error } = await getAdminClient()
    .from('proxy_requests')
    .insert({
      user_id: userId,
      category: 'RESTAURANT',
      status: 'PENDING',
      payment_channel: 'LOCALLY',
      payment_status: 'WAITING',
      locally_order_id: `LOCALLY-PROXY-${Date.now()}`,
      agreed_to_terms: true,
      form_data: {
        restaurant_name: `테스트 스시 ${Date.now()}`,
        preferred_slot_primary: '2026-01-15T19:00',
        reservation_name: user.fullName,
        guest_number: 2,
        korean_contact: user.phone,
        payment_method: 'bank',
        contact_name: user.fullName,
        contact_phone: user.phone,
        service_fee_krw: 4500,
        linked_inquiry_id: linkedInquiryId,
      },
    })
    .select('id, form_data')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create proxy request.');
  }

  createdProxyRequestIds.push(String(data.id));
  return {
    requestId: String(data.id),
    restaurantName: String((data.form_data as Record<string, unknown>)?.restaurant_name || ''),
  };
}

async function login(page: Page, user: TestUser) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
}

async function dismissAnnouncementIfVisible(page: Page) {
  const announcement = page.getByTestId('global-site-announcement-modal');
  if (await announcement.count()) {
    await page.getByTestId('global-site-announcement-primary').click();
    await expect(announcement).toHaveCount(0);
  }
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdProxyRequestIds.length > 0) {
    await supabase.from('proxy_comments').delete().in('request_id', createdProxyRequestIds);
    await supabase.from('proxy_requests').delete().in('id', createdProxyRequestIds);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('proxy booking self-service flow', () => {
  test('shows next-step guidance on board and keeps guest detail accessible for bank transfer requests', async ({ page }) => {
    const user = createUser('guest');
    const userId = await createAuthUser(user);
    const request = await createProxyRequest(userId, user);

    await login(page, user);

    await page.goto('/proxy-bookings', { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);
    await expect(page.getByText(request.restaurantName)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('2026-01-15 19:00')).toBeVisible();
    await expect(page.getByText('입금 전에는 1:1 문의함에서 계좌 안내를 확인해 주세요. 입금이 확인되면 운영팀이 다음 안내를 드립니다.')).toBeVisible();
    await expect(page.locator(`a[href="/proxy-bookings/${request.requestId}"]`)).toBeVisible();

    await page.goto(`/proxy-bookings/${request.requestId}`, { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);

    await expect(page.getByText('1:1 문의함 열기')).toBeVisible();
    await expect(page.getByText('무통장 입금 안내')).toBeVisible();
  });
});
