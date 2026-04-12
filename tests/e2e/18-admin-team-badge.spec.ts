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
const createdTaskIds: string[] = [];
const createdCommentIds: string[] = [];

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
    email: `codex.team.badge.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Team Badge Admin ${timestamp}`,
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

  const { error: whitelistError } = await supabase
    .from('admin_whitelist')
    .upsert({ email: user.email }, { onConflict: 'email' });

  if (whitelistError) throw whitelistError;
  createdWhitelistEmails.push(user.email);

  return data.user.id;
}

async function seedTeamWorkspaceActivity(authorId: string, authorName: string) {
  const supabase = getAdminClient();
  const taskContent = `코덱스 팀 배지 작업 ${Date.now()}`;
  const commentContent = `코덱스 팀 배지 댓글 ${Date.now()}`;

  const { data: task, error: taskError } = await supabase
    .from('admin_tasks')
    .insert({
      type: 'TODO',
      content: taskContent,
      author_id: authorId,
      author_name: authorName,
      is_completed: false,
    })
    .select('id')
    .single();

  if (taskError || !task?.id) {
    throw taskError || new Error('Failed to seed team task');
  }

  createdTaskIds.push(task.id);

  const { data: comment, error: commentError } = await supabase
    .from('admin_task_comments')
    .insert({
      task_id: task.id,
      content: commentContent,
      author_id: authorId,
      author_name: authorName,
    })
    .select('id')
    .single();

  if (commentError || !comment?.id) {
    throw commentError || new Error('Failed to seed team comment');
  }

  createdCommentIds.push(comment.id);
}

async function login(page: Page, user: TestUser) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

async function getTeamWorkspaceCount(page: Page) {
  const button = page.getByRole('button', { name: /Team Workspace/i });
  const text = (await button.textContent()) || '';
  const match = text.match(/(\d+)\s*$/);
  return match ? Number(match[1]) : 0;
}

async function fetchServerTeamWorkspaceCount(page: Page, lastViewed?: string) {
  return page.evaluate(async (value) => {
    if (value) {
      localStorage.setItem('last_viewed_team', value);
      Object.keys(localStorage)
        .filter((key) => key.startsWith('last_viewed_team:'))
        .forEach((key) => localStorage.setItem(key, value));
    }

    const scopedKey = Object.keys(localStorage).find((key) => key.startsWith('last_viewed_team:'));
    const current = (scopedKey && localStorage.getItem(scopedKey)) || localStorage.getItem('last_viewed_team') || new Date(0).toISOString();
    const response = await fetch(`/api/admin/team-counts?lastViewed=${encodeURIComponent(current)}`);
    const result = await response.json();

    if (!response.ok || !result?.success) {
      throw new Error(result?.error || 'Failed to fetch team workspace count');
    }

    return Number(result?.data?.newWorkspaceCount || 0);
  }, lastViewed ?? null);
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdCommentIds.length > 0) {
    await supabase.from('admin_task_comments').delete().in('id', createdCommentIds);
  }

  if (createdTaskIds.length > 0) {
    await supabase.from('admin_tasks').delete().in('id', createdTaskIds);
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

test.describe.serial('Admin team badge smoke', () => {
  test('keeps the Team Workspace sidebar label plain even when new activity exists', async ({ page }) => {
    test.setTimeout(90000);

    const adminUser = createAdminUser();
    const adminUserId = await createAuthUser(adminUser);

    await login(page, adminUser);
    await page.goto('/admin/dashboard?tab=APPROVALS', { waitUntil: 'networkidle' });

    const teamButton = page.getByRole('button', { name: /Team Workspace/i });
    const baselineViewedAt = new Date(Date.now() - 10_000).toISOString();
    const baselineCount = await fetchServerTeamWorkspaceCount(page, baselineViewedAt);

    await seedTeamWorkspaceActivity(adminUserId, adminUser.fullName);

    const seededCount = await fetchServerTeamWorkspaceCount(page);
    expect(seededCount).toBeGreaterThanOrEqual(baselineCount + 2);
    await expect(teamButton).toHaveText('Team Workspace', { timeout: 15000 });
    await expect.poll(async () => getTeamWorkspaceCount(page), { timeout: 15000 }).toBe(0);

    await teamButton.click();
    await expect(page.getByRole('heading', { name: /Team Sync HQ/i })).toBeVisible({ timeout: 15000 });
  });
});
