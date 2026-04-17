import { expect, test } from '@playwright/test';

import {
  createAuthUser,
  createTestUser,
  getTestAdminClient,
  login,
} from './helpers/testSupabase';

const TEAM_CHAT_ROOM_ID = '00000000-0000-0000-0000-000000000000';

const createdAuthUserIds: string[] = [];
const createdWhitelistEmails: string[] = [];
const createdTaskIds: string[] = [];
const createdCommentIds: string[] = [];

test.afterAll(async () => {
  const supabase = getTestAdminClient();

  if (createdCommentIds.length > 0) {
    await supabase.from('admin_task_comments').delete().in('id', createdCommentIds);
  }

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

test.describe.serial('Admin team chat cleanup contracts', () => {
  test('keeps task comments working while legacy team chat seams stay closed', async ({ page }) => {
    test.setTimeout(90000);

    const supabase = getTestAdminClient();
    const adminUser = createTestUser('team.chat.cleanup');
    const adminUserId = await createAuthUser(adminUser, { isAdmin: true });

    createdAuthUserIds.push(adminUserId);
    createdWhitelistEmails.push(adminUser.email);

    const { data: task, error: taskError } = await supabase
      .from('admin_tasks')
      .insert({
        type: 'TODO',
        content: `코덱스 팀 채팅 정리 작업 ${Date.now()}`,
        author_id: adminUserId,
        author_name: adminUser.fullName,
        is_completed: false,
      })
      .select('id')
      .single();

    if (taskError || !task?.id) {
      throw taskError || new Error('Failed to seed team workspace task.');
    }

    createdTaskIds.push(task.id);

    await login(page, adminUser);
    await page.goto('/admin/dashboard?tab=TEAM', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /Team Sync HQ/i })).toBeVisible({ timeout: 15000 });

    const commentResult = await page.evaluate(async ({ taskId }) => {
      const response = await fetch('/api/admin/team/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId,
          content: 'current team comment path should remain live',
        }),
      });

      const payload = await response.json().catch(() => null);
      return {
        status: response.status,
        payload,
      };
    }, { taskId: task.id });

    expect(commentResult.status).toBe(201);
    expect(commentResult.payload?.success).toBe(true);
    expect(typeof commentResult.payload?.data?.id).toBe('string');

    if (typeof commentResult.payload?.data?.id === 'string') {
      createdCommentIds.push(commentResult.payload.data.id);
    }

    const legacyWriteResult = await page.evaluate(async ({ taskId }) => {
      const response = await fetch('/api/admin/team/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId,
          content: 'legacy team chat path must stay closed',
        }),
      });

      const payload = await response.json().catch(() => null);
      return {
        status: response.status,
        payload,
      };
    }, { taskId: TEAM_CHAT_ROOM_ID });

    expect(legacyWriteResult.status).toBe(404);
    expect(legacyWriteResult.payload?.success).toBe(false);
    expect(String(legacyWriteResult.payload?.error || '')).toContain('작업');

    const legacyBootstrapStatus = await page.evaluate(async () => {
      const response = await fetch('/api/admin/team/chat');
      return response.status;
    });

    expect(legacyBootstrapStatus).toBe(404);

    const legacyReactionStatus = await page.evaluate(async () => {
      const response = await fetch('/api/admin/team/comments/legacy-chat-message', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reactions: {
            '❤️': ['legacy-admin-user'],
          },
        }),
      });

      return response.status;
    });

    expect(legacyReactionStatus).toBe(404);
  });
});
