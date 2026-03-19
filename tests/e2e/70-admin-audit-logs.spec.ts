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
const createdAuditLogIds: string[] = [];

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

function createAdminUser(): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.audit.admin.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Audit Admin ${timestamp}`,
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

  const { error: roleError } = await supabase
    .from('users')
    .upsert(
      {
        id: data.user.id,
        email: user.email,
        role: 'admin',
      },
      { onConflict: 'id' }
    );

  if (roleError) throw roleError;

  return data.user.id;
}

async function insertAuditLog(adminId: string, adminEmail: string, suffix: string) {
  const targetId = `audit-target-${suffix}`;
  const targetInfo = `코덱스 감사 로그 ${suffix}`;
  const { data, error } = await getAdminClient()
    .from('admin_audit_logs')
    .insert({
      admin_id: adminId,
      admin_email: adminEmail,
      action_type: 'AUDIT_RUNTIME_TEST',
      target_type: 'runtime_check',
      target_id: targetId,
      details: {
        target_info: targetInfo,
        comment: `runtime verification ${suffix}`,
        new_status: 'approved',
      },
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to seed audit log.');
  }

  createdAuditLogIds.push(String(data.id));
  return targetInfo;
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

  if (createdAuditLogIds.length > 0) {
    await supabase.from('admin_audit_logs').delete().in('id', createdAuditLogIds);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Admin audit logs runtime', () => {
  test('loads seeded logs and reflects realtime inserts for admins', async ({ page }) => {
    test.setTimeout(90000);

    const adminUser = createAdminUser();
    const adminId = await createAuthUser(adminUser);
    const seededInfo = await insertAuditLog(adminId, adminUser.email, `${Date.now()}-seeded`);

    await login(page, adminUser);
    await page.goto('/admin/dashboard?tab=ANALYTICS', { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: '운영 감사 로그' }).click();
    await expect(page.getByRole('heading', { name: '운영 감사 로그' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(seededInfo)).toBeVisible({ timeout: 15000 });

    // Give the Realtime channel a brief moment to finish subscribing before seeding the insert.
    await page.waitForTimeout(1500);

    const realtimeInfo = await insertAuditLog(adminId, adminUser.email, `${Date.now()}-realtime`);
    await expect(page.getByText(realtimeInfo)).toBeVisible({ timeout: 15000 });
  });
});
