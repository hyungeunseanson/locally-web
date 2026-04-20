import { expect, test } from '@playwright/test';

import {
  createAuthUser,
  createTestUser,
  getTestAdminClient,
  login,
} from './helpers/testSupabase';

const createdAuthUserIds: string[] = [];
const createdWhitelistEmails: string[] = [];
const createdTaskIds: string[] = [];

test.afterAll(async () => {
  const supabase = getTestAdminClient();

  if (createdTaskIds.length > 0) {
    await supabase.from('admin_task_comments').delete().in('task_id', createdTaskIds);
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

test.describe.serial('Admin team workspace manual refresh', () => {
  test('shows the shared refresh button only where intended and preserves draft state across refresh attempts', async ({ page }) => {
    test.setTimeout(90000);

    const supabase = getTestAdminClient();
    const adminUser = createTestUser('team.refresh');
    const adminUserId = await createAuthUser(adminUser, { isAdmin: true });

    createdAuthUserIds.push(adminUserId);
    createdWhitelistEmails.push(adminUser.email);

    const seededTodoContent = `새로고침 회귀 확인 TODO ${Date.now()}`;
    const { data: seededTodo, error: seededTodoError } = await supabase
      .from('admin_tasks')
      .insert({
        type: 'TODO',
        content: seededTodoContent,
        author_id: adminUserId,
        author_name: adminUser.fullName,
        is_completed: false,
      })
      .select('id')
      .single();

    if (seededTodoError || !seededTodo?.id) {
      throw seededTodoError || new Error('Failed to seed refresh regression todo.');
    }

    createdTaskIds.push(seededTodo.id);

    await login(page, adminUser);
    await page.goto('/admin/dashboard?tab=TEAM', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: /Team Sync HQ/i })).toBeVisible({ timeout: 15000 });

    const teamRefreshButton = page.getByTestId('admin-team-refresh-button');
    const teamRefreshIcon = teamRefreshButton.locator('svg');
    const todoInput = page.getByPlaceholder('할 일 추가...');
    const draftText = `수동 새로고침 draft ${Date.now()}`;
    const failedRefreshMessage = '테스트 수동 새로고침 실패';

    await expect(teamRefreshButton).toBeVisible();

    await page.getByRole('button', { name: /팀 메모장/ }).click();
    await expect(teamRefreshButton).toBeVisible();

    await page.getByRole('button', { name: /전화 예약/ }).click();
    await expect(teamRefreshButton).toHaveCount(0);
    await expect(page.getByTestId('admin-phone-reservation-refresh-button')).toBeVisible();

    await page.getByRole('button', { name: 'Daily Log & Tasks' }).click();
    await expect(teamRefreshButton).toBeVisible();
    await expect(page.getByText(seededTodoContent)).toBeVisible({ timeout: 15000 });

    let slowNextBootstrap = false;
    let failNextBootstrap = false;

    await page.route('**/api/admin/team/bootstrap', async (route) => {
      if (failNextBootstrap) {
        failNextBootstrap = false;
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: failedRefreshMessage,
          }),
        });
        return;
      }

      if (slowNextBootstrap) {
        slowNextBootstrap = false;
        const response = await route.fetch();
        await new Promise((resolve) => setTimeout(resolve, 600));
        await route.fulfill({ response });
        return;
      }

      await route.continue();
    });

    await todoInput.fill(draftText);

    slowNextBootstrap = true;
    const successRefreshResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/admin/team/bootstrap') &&
      response.request().method() === 'GET' &&
      response.status() === 200
    );

    await teamRefreshButton.click();
    await expect(teamRefreshButton).toBeDisabled();
    await expect(teamRefreshIcon).toHaveClass(/animate-spin/);
    await successRefreshResponsePromise;
    await expect(teamRefreshButton).toBeEnabled({ timeout: 15000 });
    await expect(teamRefreshIcon).not.toHaveClass(/animate-spin/);
    await expect(todoInput).toHaveValue(draftText);
    await expect(page.getByText(seededTodoContent)).toBeVisible();

    failNextBootstrap = true;
    const failedRefreshResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/admin/team/bootstrap') &&
      response.request().method() === 'GET' &&
      response.status() === 500
    );

    await teamRefreshButton.click();
    await failedRefreshResponsePromise;
    await expect(page.getByText(failedRefreshMessage, { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(teamRefreshButton).toBeEnabled({ timeout: 15000 });
    await expect(teamRefreshIcon).not.toHaveClass(/animate-spin/);
    await expect(todoInput).toHaveValue(draftText);
    await expect(page.getByText(seededTodoContent)).toBeVisible();
  });
});
