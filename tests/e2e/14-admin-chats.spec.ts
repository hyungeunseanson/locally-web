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
const createdWhitelistEmails: string[] = [];
const createdInquiryIds: number[] = [];
const createdInquiryMessageIds: number[] = [];

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
    email: `codex.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `${prefix} ${timestamp}`,
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

  if (options?.whitelistAdmin) {
    const { error: whitelistError } = await supabase
      .from('admin_whitelist')
      .upsert({ email: user.email }, { onConflict: 'email' });

    if (whitelistError) throw whitelistError;
    createdWhitelistEmails.push(user.email);
  }

  return data.user.id;
}

async function seedAdminSupportInquiry(guestUserId: string, message: string) {
  const supabase = getAdminClient();
  const now = new Date().toISOString();

  const { data: inquiry, error: inquiryError } = await supabase
    .from('inquiries')
    .insert({
      user_id: guestUserId,
      host_id: null,
      type: 'admin_support',
      status: 'open',
      content: message,
      updated_at: now,
    })
    .select('id')
    .single();

  if (inquiryError || !inquiry?.id) {
    throw inquiryError || new Error('Failed to create admin support inquiry');
  }

  createdInquiryIds.push(inquiry.id);

  const { data: insertedMessage, error: messageError } = await supabase
    .from('inquiry_messages')
    .insert({
      inquiry_id: inquiry.id,
      sender_id: guestUserId,
      content: message,
      type: 'text',
      is_read: false,
    })
    .select('id')
    .single();

  if (messageError || !insertedMessage?.id) {
    throw messageError || new Error('Failed to create inquiry message');
  }

  createdInquiryMessageIds.push(insertedMessage.id);

  return Number(inquiry.id);
}

async function login(page: Page, user: TestUser) {
  await page.goto('/login', { waitUntil: 'networkidle' });

  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdInquiryMessageIds.length > 0) {
    await supabase.from('inquiry_messages').delete().in('id', createdInquiryMessageIds);
  }

  if (createdInquiryIds.length > 0) {
    await supabase.from('inquiries').delete().in('id', createdInquiryIds);
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

test.describe.serial('Admin chats smoke', () => {
  test('updates admin support inquiry status through admin route', async ({ page }) => {
    test.setTimeout(90000);

    const adminUser = createUser('admin.chats');
    const guestUser = createUser('guest.chats');

    await createAuthUser(adminUser, { whitelistAdmin: true });
    const guestUserId = await createAuthUser(guestUser);

    const inquiryMessage = `코덱스 관리자 상담 문의 ${Date.now()}`;
    const inquiryId = await seedAdminSupportInquiry(guestUserId, inquiryMessage);

    await login(page, adminUser);
    await page.goto(`/admin/dashboard?tab=CHATS&inquiryId=${inquiryId}`, { waitUntil: 'networkidle' });

    await expect(
      page.locator('div.bg-white.border.border-slate-200.rounded-tl-none').filter({ hasText: inquiryMessage }).last()
    ).toBeVisible({ timeout: 15000 });

    const detailStatusGroup = page.locator('div.absolute.top-2.right-2');
    await detailStatusGroup.getByRole('button', { name: '처리중', exact: true }).click();

    await expect.poll(async () => {
      const { data, error } = await getAdminClient()
        .from('inquiries')
        .select('status')
        .eq('id', inquiryId)
        .maybeSingle();

      if (error) throw error;
      return data?.status || null;
    }, {
      timeout: 15000,
      intervals: [500, 1000, 1500],
    }).toBe('in_progress');
  });
});
