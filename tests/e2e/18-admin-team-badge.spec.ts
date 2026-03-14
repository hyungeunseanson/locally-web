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
  test('clears team workspace badge after visiting TEAM tab', async ({ page }) => {
    test.setTimeout(90000);

    const adminUser = createAdminUser();
    const adminUserId = await createAuthUser(adminUser);
    await seedTeamWorkspaceActivity(adminUserId, adminUser.fullName);

    await page.addInitScript(() => {
      localStorage.setItem('last_viewed_team', new Date(0).toISOString());
    });

    await login(page, adminUser);
    const teamCountsResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/admin/team-counts') &&
      response.request().method() === 'GET'
    );
    await page.goto('/admin/dashboard?tab=APPROVALS', { waitUntil: 'networkidle' });
    await teamCountsResponsePromise;

    const teamButton = page.getByRole('button', { name: /Team Workspace/i });
    await expect(teamButton).toContainText('2');

    await teamButton.click();
    await expect(page.getByRole('heading', { name: /Team Sync HQ/i })).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /Approvals/i }).click();
    await page.waitForURL(/tab=APPROVALS/i);

    await expect(teamButton).not.toContainText('2');
  });
});
