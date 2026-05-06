import { expect, test } from '@playwright/test';

import {
  createAuthUser,
  createTestUser,
  getExpectedTestCronSecret,
  getTestAdminClient,
} from './helpers/testSupabase';

const RETENTION_RPC_NAME = 'prune_notifications_retention';
const SAFE_TEST_CUTOFF = '1970-01-01T00:00:00.000Z';
const OLD_TEST_CREATED_AT = '1969-12-01T00:00:00.000Z';
const KEPT_TEST_CREATED_AT = '1970-01-02T00:00:00.000Z';
const CRON_SECRET = getExpectedTestCronSecret();

const createdAuthUserIds: string[] = [];
const createdNotificationIds: number[] = [];

function isMissingRetentionRpcError(error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | null | undefined) {
  if (!error) return false;
  const combinedMessage = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
  return (
    error.code === 'PGRST202' ||
    (combinedMessage.includes(RETENTION_RPC_NAME) &&
      (combinedMessage.includes('Could not find the function') ||
        combinedMessage.includes('No function matches') ||
        combinedMessage.includes('does not exist')))
  );
}

async function ensureRetentionRpcAvailable() {
  const supabase = getTestAdminClient();
  const { error } = await supabase.rpc(RETENTION_RPC_NAME, {
    p_cutoff: SAFE_TEST_CUTOFF,
    p_batch_size: 1,
  });

  if (isMissingRetentionRpcError(error)) {
    return false;
  }

  if (error) {
    throw error;
  }

  return true;
}

async function insertNotification(params: {
  userId: string;
  type: string;
  title: string;
  isRead: boolean;
  createdAt: string;
}) {
  const supabase = getTestAdminClient();
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: '30일 알림 자동 정리 테스트입니다.',
      link: '/notifications',
      is_read: params.isRead,
      created_at: params.createdAt,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to seed notification retention row.');
  }

  const id = Number(data.id);
  createdNotificationIds.push(id);
  return id;
}

test.afterAll(async () => {
  const supabase = getTestAdminClient();

  if (createdNotificationIds.length > 0) {
    await supabase.from('notifications').delete().in('id', createdNotificationIds);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('notification retention cleanup', () => {
  test('prunes read, unread, and admin alerts older than the cutoff in batches', async () => {
    const hasRetentionRpc = await ensureRetentionRpcAvailable();
    test.skip(!hasRetentionRpc, `${RETENTION_RPC_NAME} migration has not been applied in this test database.`);

    const user = createTestUser('notification.retention');
    const userId = await createAuthUser(user);
    createdAuthUserIds.push(userId);

    const oldUnreadId = await insertNotification({
      userId,
      type: 'booking_confirmed',
      title: '오래된 안 읽은 알림',
      isRead: false,
      createdAt: OLD_TEST_CREATED_AT,
    });
    const oldReadId = await insertNotification({
      userId,
      type: 'booking_confirmed',
      title: '오래된 읽은 알림',
      isRead: true,
      createdAt: OLD_TEST_CREATED_AT,
    });
    const oldAdminAlertId = await insertNotification({
      userId,
      type: 'admin_alert',
      title: '오래된 관리자 알림',
      isRead: false,
      createdAt: OLD_TEST_CREATED_AT,
    });
    const keptRecentId = await insertNotification({
      userId,
      type: 'booking_confirmed',
      title: '보존되는 최근 알림',
      isRead: false,
      createdAt: KEPT_TEST_CREATED_AT,
    });

    const supabase = getTestAdminClient();
    const firstBatch = await supabase.rpc(RETENTION_RPC_NAME, {
      p_cutoff: SAFE_TEST_CUTOFF,
      p_batch_size: 2,
    });
    if (firstBatch.error) throw firstBatch.error;
    expect(Number(firstBatch.data)).toBe(2);

    const secondBatch = await supabase.rpc(RETENTION_RPC_NAME, {
      p_cutoff: SAFE_TEST_CUTOFF,
      p_batch_size: 2,
    });
    if (secondBatch.error) throw secondBatch.error;
    expect(Number(secondBatch.data)).toBe(1);

    const thirdBatch = await supabase.rpc(RETENTION_RPC_NAME, {
      p_cutoff: SAFE_TEST_CUTOFF,
      p_batch_size: 2,
    });
    if (thirdBatch.error) throw thirdBatch.error;
    expect(Number(thirdBatch.data)).toBe(0);

    const { data: remainingRows, error: remainingError } = await supabase
      .from('notifications')
      .select('id')
      .in('id', [oldUnreadId, oldReadId, oldAdminAlertId, keptRecentId]);

    if (remainingError) throw remainingError;

    const remainingIds = new Set((remainingRows || []).map((row) => Number(row.id)));
    expect(remainingIds.has(oldUnreadId)).toBe(false);
    expect(remainingIds.has(oldReadId)).toBe(false);
    expect(remainingIds.has(oldAdminAlertId)).toBe(false);
    expect(remainingIds.has(keptRecentId)).toBe(true);
  });

  test('allows the cron route with the configured secret when explicitly enabled', async ({ request }) => {
    test.skip(
      process.env.RUN_NOTIFICATION_RETENTION_CRON_MUTATION_TEST !== '1',
      'The cron route deletes real 30-day-old notifications, so this test is opt-in.'
    );

    const hasRetentionRpc = await ensureRetentionRpcAvailable();
    test.skip(!hasRetentionRpc, `${RETENTION_RPC_NAME} migration has not been applied in this test database.`);

    const response = await request.get('/api/cron/notification-retention-cleanup', {
      headers: {
        authorization: `Bearer ${CRON_SECRET}`,
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(typeof body.cutoff).toBe('string');
    expect(typeof body.deletedCount).toBe('number');
    expect(typeof body.batches).toBe('number');
  });
});
