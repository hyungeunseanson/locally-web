import { expect, test } from '@playwright/test';

import {
  createAuthUser,
  createTestUser,
  getTestAdminClient,
  login,
} from './helpers/testSupabase';
import {
  extractAdminFilePathFromUrl,
  extractAdminFilePathsFromMarkdown,
  isMissingTeamWorkspaceRpcError,
} from '@/app/utils/teamWorkspaceRetention';

const createdAuthUserIds: string[] = [];
const createdWhitelistEmails: string[] = [];
const createdTaskIds: string[] = [];
const createdStoragePaths: string[] = [];

test.afterAll(async () => {
  const supabase = getTestAdminClient();

  if (createdTaskIds.length > 0) {
    await supabase.from('admin_task_comments').delete().in('task_id', createdTaskIds);
    await supabase.from('admin_tasks').delete().in('id', createdTaskIds);
  }

  if (createdStoragePaths.length > 0) {
    await supabase.storage.from('admin_files').remove(createdStoragePaths);
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

test.describe.serial('Team workspace retention contracts', () => {
  test('extracts only supported team workspace memo image paths', () => {
    const publicUrl = 'https://example.supabase.co/storage/v1/object/public/admin_files/markdown_images/memo-a.png';
    const signedUrl = 'https://example.supabase.co/storage/v1/object/sign/admin_files/markdown_images/memo-b.png?token=test';
    const chatUrl = 'https://example.supabase.co/storage/v1/object/public/admin_files/chat_images/chat-a.png';

    const content = [
      `![Memo A](${publicUrl})`,
      `![Memo B](${signedUrl})`,
      `![Ignored external](https://example.com/image.png)`,
      `![Ignored chat](${chatUrl})`,
      `<img src="${publicUrl}" alt="duplicate" />`,
    ].join('\n');

    expect(extractAdminFilePathsFromMarkdown(content)).toEqual([
      'markdown_images/memo-a.png',
      'markdown_images/memo-b.png',
    ]);

    expect(extractAdminFilePathFromUrl(publicUrl)).toBe('markdown_images/memo-a.png');
    expect(extractAdminFilePathFromUrl(chatUrl)).toBeNull();
    expect(
      isMissingTeamWorkspaceRpcError(
        {
          code: 'PGRST202',
          message: 'Could not find the function public.prune_team_workspace_tasks',
        },
        'prune_team_workspace_tasks'
      )
    ).toBe(true);
  });

  test('manual memo delete removes child comments and uploaded memo images', async ({ page }) => {
    test.setTimeout(90000);

    const supabase = getTestAdminClient();
    const adminUser = createTestUser('team.retention');
    const adminUserId = await createAuthUser(adminUser, { isAdmin: true });
    createdAuthUserIds.push(adminUserId);
    createdWhitelistEmails.push(adminUser.email);

    const storageFilename = `codex-team-retention-${Date.now()}.png`;
    const storagePath = `markdown_images/${storageFilename}`;
    createdStoragePaths.push(storagePath);

    const { error: uploadError } = await supabase.storage
      .from('admin_files')
      .upload(storagePath, Buffer.from('codex-team-retention-image'), {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from('admin_files').getPublicUrl(storagePath);
    const memoContent = [
      `# 팀 메모 ${Date.now()}`,
      '',
      `![정리 대상](${publicUrlData.publicUrl})`,
      '',
      '삭제 시 메모 이미지도 함께 정리되어야 합니다.',
    ].join('\n');

    const { data: task, error: taskError } = await supabase
      .from('admin_tasks')
      .insert({
        type: 'MEMO',
        content: memoContent,
        is_completed: false,
        author_id: adminUserId,
        author_name: adminUser.fullName,
        metadata: {},
      })
      .select('id')
      .single();

    if (taskError || !task?.id) {
      throw taskError || new Error('Failed to seed memo task.');
    }

    createdTaskIds.push(task.id);

    const { error: commentError } = await supabase
      .from('admin_task_comments')
      .insert({
        task_id: task.id,
        content: `메모 댓글 ${Date.now()}`,
        author_id: adminUserId,
        author_name: adminUser.fullName,
      });

    if (commentError) throw commentError;

    await login(page, adminUser);
    await page.goto('/admin/dashboard?tab=TEAM', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: /Team Sync HQ/i })).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText(/워크스페이스 항목은 최근 100개, 각 댓글 스레드는 최근 100개만 보관되며/)
    ).toBeVisible({ timeout: 15000 });

    const deleteResult = await page.evaluate(async ({ taskId }) => {
      const response = await fetch(`/api/admin/team/tasks/${taskId}`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => null);
      return {
        status: response.status,
        payload,
      };
    }, { taskId: task.id });

    expect(deleteResult.status).toBe(200);
    expect(deleteResult.payload?.success).toBe(true);

    await expect
      .poll(async () => {
        const { data, error } = await supabase
          .from('admin_tasks')
          .select('id')
          .eq('id', task.id)
          .maybeSingle();

        if (error) throw error;
        return data?.id ?? null;
      }, {
        timeout: 15000,
        intervals: [500, 1000, 1500],
      })
      .toBe(null);

    await expect
      .poll(async () => {
        const { count, error } = await supabase
          .from('admin_task_comments')
          .select('id', { count: 'exact', head: true })
          .eq('task_id', task.id);

        if (error) throw error;
        return count || 0;
      }, {
        timeout: 15000,
        intervals: [500, 1000, 1500],
      })
      .toBe(0);

    await expect
      .poll(async () => {
        const { data, error } = await supabase.storage
          .from('admin_files')
          .list('markdown_images', { search: storageFilename });

        if (error) throw error;
        return (data || []).some((entry) => entry.name === storageFilename);
      }, {
        timeout: 15000,
        intervals: [500, 1000, 1500],
      })
      .toBe(false);
  });
});
