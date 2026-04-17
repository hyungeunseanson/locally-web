import { expect, type Browser, type Page } from '@playwright/test';

import { getTestAdminClient, type E2ETestUser } from './testSupabase';

export type ReleaseJourneyLocale = 'ko' | 'en' | 'ja' | 'zh';

type NotificationRow = {
  id: number;
  user_id: string;
  type: string | null;
  title: string | null;
  message: string | null;
  link: string | null;
  created_at: string;
};

type AuditLogRow = {
  id: string;
  action_type: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

function getLoginSuccessMessage(locale: ReleaseJourneyLocale) {
  switch (locale) {
    case 'en':
      return 'Welcome back. You are now logged in.';
    case 'ja':
      return 'ログインしました。ようこそ。';
    case 'zh':
      return '欢迎回来，您已登录。';
    case 'ko':
    default:
      return '환영합니다! 로그인 되었습니다.';
  }
}

export async function setPreferredLocale(userId: string, locale: ReleaseJourneyLocale) {
  const supabase = getTestAdminClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) {
    throw error || new Error(`Failed to fetch auth user ${userId}.`);
  }

  const metadata =
    data.user.user_metadata && typeof data.user.user_metadata === 'object'
      ? (data.user.user_metadata as Record<string, unknown>)
      : {};

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...metadata,
      preferred_locale: locale,
    },
  });

  if (updateError) throw updateError;
}

export async function loginWithLocale(
  page: Page,
  user: E2ETestUser,
  locale: ReleaseJourneyLocale = 'ko'
) {
  await page.context().clearCookies();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((nextLocale) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('app_lang', nextLocale);
    document.cookie = `app_lang=${nextLocale}; path=/; samesite=lax`;
  }, locale);
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 30000 });

  const successMessage = getLoginSuccessMessage(locale);
  let completed = false;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.locator('input[type="email"]').fill(user.email);
    await page.locator('input[type="password"]').fill(user.password);
    await page.locator('button[type="submit"]').click();

    const results = await Promise.allSettled([
      page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 }),
      page.getByText(successMessage, { exact: true }).waitFor({ state: 'visible', timeout: 15000 }),
    ]);

    if (results.some((result) => result.status === 'fulfilled')) {
      completed = true;
      break;
    }

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 15000 });
  }

  if (!completed) {
    throw new Error(`Login did not complete for ${user.email}`);
  }

  if (page.url().includes('/login')) {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  }
  await page.waitForLoadState('domcontentloaded');
}

export async function createIsolatedPage(
  browser: Browser,
  user: E2ETestUser,
  locale: ReleaseJourneyLocale = 'ko'
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginWithLocale(page, user, locale);
  return { context, page };
}

export async function dismissAnnouncementIfVisible(page: Page) {
  const announcement = page.getByTestId('global-site-announcement-modal');
  if (await announcement.count()) {
    await page.getByTestId('global-site-announcement-primary').click({ force: true });
    await expect(announcement).toHaveCount(0);
  }
}

export async function waitForNotification(params: {
  userId: string;
  title?: string;
  type?: string;
  linkIncludes?: string;
}) {
  const supabase = getTestAdminClient();

  for (let attempt = 0; attempt < 30; attempt += 1) {
    let query = supabase
      .from('notifications')
      .select('id, user_id, type, title, message, link, created_at')
      .eq('user_id', params.userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (params.type) {
      query = query.eq('type', params.type);
    }

    const { data, error } = await query;
    if (error) throw error;

    const matched = ((data || []) as NotificationRow[]).find((row) => {
      if (params.title && row.title !== params.title) return false;
      if (params.linkIncludes) {
        return typeof row.link === 'string' && row.link.includes(params.linkIncludes);
      }
      return true;
    });

    if (matched) {
      return matched;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Notification not found for ${params.userId} (${params.type || 'any'} / ${params.title || 'any'}).`
  );
}

export async function waitForAuditLog(params: {
  actionType: string;
  targetType?: string;
  targetId?: string;
}) {
  const supabase = getTestAdminClient();

  for (let attempt = 0; attempt < 30; attempt += 1) {
    let query = supabase
      .from('admin_audit_logs')
      .select('id, action_type, target_type, target_id, details, created_at')
      .eq('action_type', params.actionType)
      .order('created_at', { ascending: false })
      .limit(20);

    if (params.targetType) {
      query = query.eq('target_type', params.targetType);
    }

    if (params.targetId) {
      query = query.eq('target_id', params.targetId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const matched = ((data || []) as AuditLogRow[])[0];
    if (matched) return matched;

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Audit log not found (${params.actionType} / ${params.targetType || 'any'} / ${params.targetId || 'any'}).`
  );
}

export async function supportsServiceRequestId() {
  const { error } = await getTestAdminClient()
    .from('inquiries')
    .select('service_request_id')
    .limit(1);

  return !error;
}
