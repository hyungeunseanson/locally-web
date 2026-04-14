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

type InquiryRow = {
  id: number | string;
  user_id: string;
  host_id: string | null;
  type: string | null;
  status: string | null;
  content: string | null;
  service_request_id?: string | null;
};

const TEST_PASSWORD = 'LocallyTest!2026';

let adminClient: SupabaseClient | null = null;
const createdAuthUserIds: string[] = [];
const createdWhitelistEmails: string[] = [];
const createdInquiryIds: Array<number | string> = [];
const createdServiceRequestIds: string[] = [];
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
    email: `codex.messaging.boundary.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Messaging Boundary ${prefix} ${timestamp}`,
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

async function createAuthUser(user: TestUser, options?: { whitelistAdmin?: boolean }) {
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

  if (options?.whitelistAdmin) {
    const { error: whitelistError } = await supabase
      .from('admin_whitelist')
      .upsert({ email: user.email }, { onConflict: 'email' });

    if (whitelistError) throw whitelistError;
    createdWhitelistEmails.push(user.email);
  }

  return data.user.id;
}

async function login(page: Page, user: TestUser) {
  await page.context().clearCookies();
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

async function createAdminSupportInquiry(params: {
  guestId: string;
  hostId?: string | null;
  type?: 'admin_support' | 'admin';
  status?: 'open' | 'in_progress' | 'resolved' | null;
  content: string;
}) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('inquiries')
    .insert({
      user_id: params.guestId,
      host_id: params.hostId ?? null,
      type: params.type ?? 'admin_support',
      status: params.status ?? 'open',
      content: params.content,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create admin support inquiry fixture.');
  }

  createdInquiryIds.push(data.id);
  return Number(data.id);
}

async function readInquiry(inquiryId: number | string) {
  const { data, error } = await getAdminClient()
    .from('inquiries')
    .select('id, user_id, host_id, type, status, content, service_request_id')
    .eq('id', inquiryId)
    .maybeSingle<InquiryRow>();

  if (error) throw error;
  return data;
}

async function supportsServiceRequestId() {
  const { error } = await getAdminClient()
    .from('inquiries')
    .select('service_request_id')
    .limit(1);

  return !error;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function createServiceRequest(params: {
  guestId: string;
  guest: TestUser;
  hostId: string;
  label: string;
}) {
  const supabase = getAdminClient();
  const date = new Date();
  date.setDate(date.getDate() + 7);

  const { data, error } = await supabase
    .from('service_requests')
    .insert({
      user_id: params.guestId,
      selected_host_id: params.hostId,
      title: `[Playwright] Messaging Boundary ${params.label} ${Date.now()}`,
      description: '메시징 boundary contract 검증용 서비스 의뢰입니다.',
      city: '서울',
      country: 'Korea',
      service_date: formatDate(date),
      start_time: '11:00',
      duration_hours: 4,
      languages: ['한국어'],
      guest_count: 2,
      contact_name: params.guest.fullName,
      contact_phone: params.guest.phone,
      status: 'open',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create service request fixture.');
  }

  createdServiceRequestIds.push(data.id);
  return data.id;
}

async function createProxyRequestWithoutLinkedInquiry(userId: string, user: TestUser) {
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
      },
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create proxy request fixture.');
  }

  createdProxyRequestIds.push(String(data.id));
  return String(data.id);
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdProxyRequestIds.length > 0) {
    await supabase.from('proxy_comments').delete().in('request_id', createdProxyRequestIds);
    await supabase.from('proxy_requests').delete().in('id', createdProxyRequestIds);
  }

  if (createdInquiryIds.length > 0) {
    await supabase.from('inquiry_messages').delete().in('inquiry_id', createdInquiryIds);
    await supabase.from('inquiries').delete().in('id', createdInquiryIds);
  }

  if (createdServiceRequestIds.length > 0) {
    await supabase.from('service_requests').delete().in('id', createdServiceRequestIds);
  }

  for (const email of createdWhitelistEmails) {
    await supabase.from('admin_whitelist').delete().eq('email', email);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Messaging boundary contracts', () => {
  test('admin_initiated_support openOnly does not reuse a resolved support thread', async ({ page }) => {
    const adminUser = createUser('admin');
    const guestUser = createUser('guest');

    const adminId = await createAuthUser(adminUser, { whitelistAdmin: true });
    const guestId = await createAuthUser(guestUser);
    const resolvedInquiryId = await createAdminSupportInquiry({
      guestId,
      status: 'resolved',
      content: `resolved support ${Date.now()}`,
    });

    await login(page, adminUser);

    const response = await page.request.post('/api/inquiries/thread', {
      data: {
        contextType: 'admin_initiated_support',
        guestId,
        openOnly: true,
      },
    });

    expect(response.ok()).toBeTruthy();
    const json = await response.json();

    expect(json).toMatchObject({
      success: true,
      inquiryType: 'admin_support',
      guestId,
      hostId: adminId,
      createdThread: true,
      createdMessage: false,
    });
    expect(Number(json.inquiryId)).not.toBe(resolvedInquiryId);

    createdInquiryIds.push(Number(json.inquiryId));

    const createdInquiry = await readInquiry(json.inquiryId);
    expect(createdInquiry).toMatchObject({
      id: json.inquiryId,
      user_id: guestId,
      host_id: adminId,
      type: 'admin_support',
      content: '관리자가 문의를 시작했습니다.',
    });
    expect(createdInquiry?.status ?? null).not.toBe('resolved');
  });

  test('service_request start-chat scopes inquiries by request id when service_request_id is available', async ({ page }) => {
    test.skip(!(await supportsServiceRequestId()), 'service_request_id capability is unavailable in this environment.');

    const guestUser = createUser('service-guest');
    const hostUser = createUser('service-host');

    const guestId = await createAuthUser(guestUser);
    const hostId = await createAuthUser(hostUser);
    const requestAId = await createServiceRequest({
      guestId,
      guest: guestUser,
      hostId,
      label: 'request-a',
    });
    const requestBId = await createServiceRequest({
      guestId,
      guest: guestUser,
      hostId,
      label: 'request-b',
    });

    await login(page, guestUser);

    const [responseA, responseB] = await Promise.all([
      page.request.post('/api/services/start-chat', { data: { requestId: requestAId } }),
      page.request.post('/api/services/start-chat', { data: { requestId: requestBId } }),
    ]);

    expect(responseA.ok()).toBeTruthy();
    expect(responseB.ok()).toBeTruthy();

    const jsonA = await responseA.json();
    const jsonB = await responseB.json();

    expect(jsonA.success).toBe(true);
    expect(jsonB.success).toBe(true);
    expect(String(jsonA.inquiryId)).not.toBe(String(jsonB.inquiryId));

    createdInquiryIds.push(String(jsonA.inquiryId));
    createdInquiryIds.push(String(jsonB.inquiryId));

    const [inquiryA, inquiryB] = await Promise.all([
      readInquiry(jsonA.inquiryId),
      readInquiry(jsonB.inquiryId),
    ]);

    expect(inquiryA).toMatchObject({
      user_id: guestId,
      host_id: hostId,
      service_request_id: requestAId,
    });
    expect(inquiryB).toMatchObject({
      user_id: guestId,
      host_id: hostId,
      service_request_id: requestBId,
    });
  });

  test('proxy booking comments fail closed when linked inquiry is missing', async ({ page }) => {
    const guestUser = createUser('proxy-guest');
    const guestId = await createAuthUser(guestUser);
    const requestId = await createProxyRequestWithoutLinkedInquiry(guestId, guestUser);

    await login(page, guestUser);

    const response = await page.request.post(`/api/proxy-bookings/${requestId}/comments`, {
      data: {
        content: `linked inquiry missing ${Date.now()}`,
      },
    });

    expect(response.status()).toBe(409);
    const json = await response.json();
    expect(json).toMatchObject({
      success: false,
      error: '전화 예약 문의 스레드가 연결되어 있지 않습니다.',
    });
  });
});
