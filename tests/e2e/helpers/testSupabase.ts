import { existsSync, readFileSync } from 'fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';

import { assertNonProductionSupabaseTarget } from './productionSupabaseGuard';

type EnvMap = Record<string, string>;
type EnvLikeMap = Record<string, string | undefined>;

const LOCAL_DEV_FALLBACK_CRON_SECRET = 'codex-cron-secret';

function loadOptionalEnvFile(path: string): EnvMap {
  if (!existsSync(path)) {
    return {};
  }

  return readFileSync(path, 'utf8')
    .split(/\n/)
    .reduce<EnvMap>((acc, line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) acc[match[1]] = match[2];
      return acc;
    }, {});
}

function readTrimmedEnvValue(env: EnvLikeMap, key: string) {
  const value = env[key];
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export type E2ETestUser = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
};

export const TEST_PASSWORD = 'LocallyTest!2026';

let adminClient: SupabaseClient | null = null;

export function loadTestEnv(): EnvMap {
  const fileEnv = loadOptionalEnvFile('.env.local');
  const processEnv = Object.entries(process.env).reduce<EnvMap>((acc, [key, value]) => {
    if (typeof value === 'string') acc[key] = value;
    return acc;
  }, {});

  return { ...fileEnv, ...processEnv };
}

function resolveCronEnv(env?: EnvLikeMap) {
  if (env) {
    return env;
  }

  return {
    ...loadOptionalEnvFile('.env.local'),
    ...process.env,
  };
}

export function getConfiguredCronSecret(env?: EnvLikeMap) {
  return readTrimmedEnvValue(resolveCronEnv(env), 'CRON_SECRET');
}

export function getExpectedTestCronSecret(options?: {
  env?: EnvLikeMap;
  productionLike?: boolean;
}) {
  const configuredSecret = getConfiguredCronSecret(options?.env);
  if (configuredSecret) return configuredSecret;
  if (options?.productionLike) return null;
  return LOCAL_DEV_FALLBACK_CRON_SECRET;
}

export function getTestAdminClient() {
  assertNonProductionSupabaseTarget();
  if (adminClient) return adminClient;

  const env = loadTestEnv();
  adminClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  return adminClient;
}

export function createTestUser(prefix: string): E2ETestUser {
  const timestamp = Date.now();
  return {
    email: `codex.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `${prefix.replace(/\./g, ' ')} ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

export function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function waitForProfile(userId: string) {
  const supabase = getTestAdminClient();

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

export async function createAuthUser(user: E2ETestUser, options?: { isAdmin?: boolean }) {
  const supabase = getTestAdminClient();
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

  await waitForProfile(data.user.id);

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: user.fullName,
      phone: user.phone,
    })
    .eq('id', data.user.id);

  if (profileError) throw profileError;

  if (options?.isAdmin) {
    const { error: whitelistError } = await supabase
      .from('admin_whitelist')
      .upsert({ email: user.email }, { onConflict: 'email' });

    if (whitelistError) throw whitelistError;
  }

  return data.user.id;
}

export async function cleanupTestUsers(userIds: string[]) {
  const supabase = getTestAdminClient();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return;

  const inquiryFilter = `user_id.in.(${ids.join(',')}),host_id.in.(${ids.join(',')})`;
  const notificationFilter = `user_id.in.(${ids.join(',')}),sender_id.in.(${ids.join(',')})`;
  const { data: inquiryRows, error: inquiryReadError } = await supabase
    .from('inquiries')
    .select('id')
    .or(inquiryFilter);
  if (inquiryReadError) throw inquiryReadError;

  const inquiryIds = (inquiryRows || []).map((row) => row.id);
  if (inquiryIds.length > 0) {
    const { error: inquiryMessageError } = await supabase
      .from('inquiry_messages')
      .delete()
      .in('inquiry_id', inquiryIds);
    if (inquiryMessageError) throw inquiryMessageError;
  }

  const { error: senderMessageError } = await supabase
    .from('inquiry_messages')
    .delete()
    .in('sender_id', ids);
  if (senderMessageError) throw senderMessageError;

  const { error: notificationError } = await supabase
    .from('notifications')
    .delete()
    .or(notificationFilter);
  if (notificationError) throw notificationError;

  if (inquiryIds.length > 0) {
    const { error: inquiryDeleteError } = await supabase
      .from('inquiries')
      .delete()
      .in('id', inquiryIds);
    if (inquiryDeleteError) throw inquiryDeleteError;
  }

  const { error: auditLogError } = await supabase
    .from('admin_audit_logs')
    .delete()
    .in('admin_id', ids);
  if (auditLogError) throw auditLogError;

  const { error: experienceError } = await supabase
    .from('experiences')
    .delete()
    .in('host_id', ids);
  if (experienceError) throw experienceError;

  const { error: hostApplicationError } = await supabase
    .from('host_applications')
    .delete()
    .in('user_id', ids);
  if (hostApplicationError) throw hostApplicationError;

  for (const userId of ids) {
    const { data: authUserData, error: authUserReadError } = await supabase.auth.admin.getUserById(userId);
    if (authUserReadError) throw authUserReadError;
    const email = authUserData.user?.email?.trim();
    if (email) {
      const { error: whitelistError } = await supabase
        .from('admin_whitelist')
        .delete()
        .eq('email', email);
      if (whitelistError) throw whitelistError;
    }
  }

  const { error: publicUserError } = await supabase.from('users').delete().in('id', ids);
  if (publicUserError) throw publicUserError;

  const { error: profileError } = await supabase.from('profiles').delete().in('id', ids);
  if (profileError) throw profileError;

  for (const userId of ids) {
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
    if (authDeleteError) throw authDeleteError;
  }
}

export async function login(page: Page, user: E2ETestUser) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}
