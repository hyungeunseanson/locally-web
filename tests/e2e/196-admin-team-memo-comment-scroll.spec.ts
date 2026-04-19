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

test.describe.serial('Admin team memo comment scroll regression', () => {
  test('keeps memo comments scrollable without clipping the composer', async ({ page }) => {
    test.setTimeout(90000);

    const supabase = getTestAdminClient();
    const adminUser = createTestUser('team.memo.scroll');
    const adminUserId = await createAuthUser(adminUser, { isAdmin: true });

    createdAuthUserIds.push(adminUserId);
    createdWhitelistEmails.push(adminUser.email);

    const memoTitle = `Memo scroll regression ${Date.now()}`;
    const memoContent = [
      `# ${memoTitle}`,
      '',
      '긴 댓글 회귀를 확인하는 테스트용 메모입니다.',
    ].join('\n');

    const longCommentContent = Array.from(
      { length: 32 },
      (_, index) => `긴 댓글 줄 ${index + 1} - 팀 메모 댓글 스크롤 회귀를 막기 위한 테스트 문장입니다.`
    )
      .concat(`긴 댓글 끝 ${Date.now()}`)
      .join('\n');

    const { data: memoTask, error: memoTaskError } = await supabase
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

    if (memoTaskError || !memoTask?.id) {
      throw memoTaskError || new Error('Failed to seed memo task.');
    }

    createdTaskIds.push(memoTask.id);

    const { data: memoComment, error: memoCommentError } = await supabase
      .from('admin_task_comments')
      .insert({
        task_id: memoTask.id,
        content: longCommentContent,
        author_id: adminUserId,
        author_name: adminUser.fullName,
      })
      .select('id')
      .single();

    if (memoCommentError || !memoComment?.id) {
      throw memoCommentError || new Error('Failed to seed memo comment.');
    }

    createdCommentIds.push(memoComment.id);

    await login(page, adminUser);
    await page.goto('/admin/dashboard?tab=TEAM', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: /Team Sync HQ/i })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /팀 메모장/ }).click();

    const memoCard = page.getByTestId('team-memo-card').filter({ hasText: memoTitle }).first();
    await expect(memoCard).toBeVisible({ timeout: 15000 });

    const commentList = memoCard.getByTestId('team-memo-comment-list');
    await expect(commentList).toBeVisible();

    const scrollMetrics = await commentList.evaluate((node) => {
      const element = node as HTMLDivElement;
      return {
        clientHeight: element.clientHeight,
        overflowY: window.getComputedStyle(element).overflowY,
        scrollHeight: element.scrollHeight,
      };
    });

    expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
    expect(['auto', 'scroll']).toContain(scrollMetrics.overflowY);

    const scrollTopAfterJump = await commentList.evaluate((node) => {
      const element = node as HTMLDivElement;
      element.scrollTop = element.scrollHeight;
      return element.scrollTop;
    });

    expect(scrollTopAfterJump).toBeGreaterThan(0);

    const layoutMetrics = await memoCard.evaluate((node) => {
      const card = node as HTMLDivElement;
      const commentInput = card.querySelector('[data-testid="team-memo-comment-input"]');
      const sendButton = card.querySelector('[data-testid="team-memo-comment-send"]');

      if (!(commentInput instanceof HTMLElement) || !(sendButton instanceof HTMLElement)) {
        return null;
      }

      const cardRect = card.getBoundingClientRect();
      const inputRect = commentInput.getBoundingClientRect();
      const sendRect = sendButton.getBoundingClientRect();

      return {
        cardBottom: cardRect.bottom,
        inputBottom: inputRect.bottom,
        sendBottom: sendRect.bottom,
      };
    });

    expect(layoutMetrics).not.toBeNull();
    expect(layoutMetrics?.inputBottom ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual((layoutMetrics?.cardBottom ?? 0) + 1);
    expect(layoutMetrics?.sendBottom ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual((layoutMetrics?.cardBottom ?? 0) + 1);
  });
});
