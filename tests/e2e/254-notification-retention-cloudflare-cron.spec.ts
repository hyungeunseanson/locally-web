import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { executeNotificationRetentionCleanupCron } from '../../app/api/cron/notification-retention-cleanup/route';
import {
  buildNotificationRetentionCutoff,
  createCloudflareNotificationRetentionRepository,
  createSupabaseNotificationRetentionRepository,
  handleNotificationRetentionCleanupScheduled,
  isNotificationRetentionEligible,
  NOTIFICATION_RETENTION_BATCH_SIZE,
  NOTIFICATION_RETENTION_CLEANUP_CRON,
  NOTIFICATION_RETENTION_MAX_BATCHES,
  NOTIFICATION_RETENTION_MAX_DELETES,
  NotificationRetentionCleanupError,
  runNotificationRetentionCleanup,
  type NotificationRetentionRepository,
} from '../../app/utils/notificationRetentionCleanup';
import { handleLocallyScheduledEvent } from '../../app/utils/cloudflareScheduled';
import { ADMIN_SUPPORT_UNREAD_ALERTS_CRON } from '../../app/utils/adminSupportUnreadAlertsScheduled';
import { HOME_POPULARITY_SNAPSHOT_CRON } from '../../app/utils/homePopularitySnapshot';

const fixedNow = new Date('2026-09-15T12:00:00.000Z');
const productionEnvironment = {
  CLOUDFLARE_DEPLOYMENT_ENV: 'production',
  NOTIFICATION_RETENTION_CLEANUP_SCHEDULED_ENABLED: 'true',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329',
  SUPABASE_SERVICE_ROLE_KEY: 'private-fixture-service-role',
};

function multiplexerOptions(calls: string[]) {
  return {
    dailyCron: HOME_POPULARITY_SNAPSHOT_CRON,
    adminSupportCron: ADMIN_SUPPORT_UNREAD_ALERTS_CRON,
    notificationRetentionCron: NOTIFICATION_RETENTION_CLEANUP_CRON,
    experienceCompletionCron: '23 */2 * * *',
    runTranslationRecovery: () => calls.push('translation'),
    runHomePopularitySnapshot: () => calls.push('home'),
    runAdminSupportUnreadAlerts: () => calls.push('admin-support'),
    runNotificationRetentionCleanup: () => calls.push('retention'),
    runExperienceCompletionSync: () => calls.push('completion'),
    log: () => undefined,
  };
}

test.describe('notification retention Cloudflare Cron', () => {
  test('preserves the exact 30-day cutoff and bounded 1000 x 5 processor contract', async () => {
    const calls: Array<{ cutoff: string; batchSize: number }> = [];
    const results = [1000, 1000, 14];
    const repository: NotificationRetentionRepository = {
      async prune(cutoff, batchSize) {
        calls.push({ cutoff, batchSize });
        return results.shift() ?? 0;
      },
    };
    const result = await runNotificationRetentionCleanup(repository, {
      now: () => fixedNow,
    });
    expect(buildNotificationRetentionCutoff(fixedNow)).toBe('2026-08-16T12:00:00.000Z');
    expect(result).toEqual({
      success: true,
      cutoff: '2026-08-16T12:00:00.000Z',
      deletedCount: 2014,
      batches: 3,
    });
    expect(calls).toHaveLength(3);
    expect(new Set(calls.map((call) => call.cutoff)).size).toBe(1);
    expect(calls.every((call) => call.batchSize === NOTIFICATION_RETENTION_BATCH_SIZE)).toBe(true);
    expect(NOTIFICATION_RETENTION_MAX_BATCHES).toBe(5);
    expect(NOTIFICATION_RETENTION_MAX_DELETES).toBe(5000);
  });

  test('stops at the hard ceiling and rejects malformed RPC counts', async () => {
    let calls = 0;
    const repository: NotificationRetentionRepository = {
      async prune() {
        calls += 1;
        return 1000;
      },
    };
    await expect(runNotificationRetentionCleanup(repository, { now: () => fixedNow }))
      .resolves.toMatchObject({ deletedCount: 5000, batches: 5 });
    expect(calls).toBe(5);
    await expect(runNotificationRetentionCleanup(repository, { batchSize: 1001 }))
      .rejects.toMatchObject({ diagnosticCode: 'invalid_cleanup_budget' });

    for (const invalid of [-1, 1.2, 1001, Number.NaN]) {
      const adapter = createSupabaseNotificationRetentionRepository({
        rpc: async () => ({ data: invalid, error: null }),
      });
      await expect(adapter.prune('2026-01-01T00:00:00.000Z', 1000))
        .rejects.toMatchObject({ diagnosticCode: 'rpc_invalid_deleted_count' });
    }
  });

  test('stops immediately on an RPC error without starting another batch', async () => {
    let calls = 0;
    const repository: NotificationRetentionRepository = {
      async prune() {
        calls += 1;
        throw new NotificationRetentionCleanupError('rpc', 'rpc_server_error', 503);
      },
    };
    await expect(runNotificationRetentionCleanup(repository, { now: () => fixedNow }))
      .rejects.toMatchObject({
        diagnosticStage: 'rpc',
        diagnosticCode: 'rpc_server_error',
        httpStatus: 503,
      });
    expect(calls).toBe(1);
  });

  test('keeps the authoritative protected-notification predicate, lock, order, clamp, and ACL contract', () => {
    const migration = readFileSync('docs/migrations/v3_40_33_profile_demographics_reminder.sql', 'utf8');
    const start = migration.indexOf('CREATE OR REPLACE FUNCTION public.prune_notifications_retention');
    const end = migration.indexOf('GRANT EXECUTE ON FUNCTION public.prune_notifications_retention', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const definition = migration.slice(start, end);
    expect(definition).toContain('SECURITY DEFINER');
    expect(definition).toContain('SET search_path = public, pg_catalog');
    expect(definition).toContain("pg_advisory_xact_lock(hashtext('notifications_retention_cleanup_v1'))");
    expect(definition).toContain('LEAST(GREATEST(COALESCE(p_batch_size, 1000), 1), 5000)');
    expect(definition).toContain('WHERE created_at < p_cutoff');
    expect(definition).toContain("type = 'profile_demographics_required'");
    expect(definition).toContain('is_read = FALSE');
    expect(definition).toContain('ORDER BY created_at ASC, id ASC');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.prune_notifications_retention');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.prune_notifications_retention');
    expect(migration).toContain('TO service_role');
  });

  test('preflight classifies old protected/read/admin/message and recent rows without exposing identities', () => {
    const cutoff = '2026-08-16T12:00:00.000Z';
    const rows = [
      { id: 'protected-id', type: 'profile_demographics_required', is_read: false, created_at: '2026-08-01T00:00:00.000Z' },
      { id: 'read-demographics-id', type: 'profile_demographics_required', is_read: true, created_at: '2026-08-01T00:00:01.000Z' },
      { id: 'admin-id', type: 'admin_alert', is_read: false, created_at: '2026-08-01T00:00:02.000Z' },
      { id: 'message-id', type: 'new_message', is_read: true, created_at: '2026-08-01T00:00:03.000Z' },
      { id: 'recent-id', type: 'admin_alert', is_read: true, created_at: '2026-09-01T00:00:00.000Z' },
    ];
    expect(rows.map((row) => isNotificationRetentionEligible(row, cutoff))).toEqual([
      false, true, true, true, false,
    ]);
  });

  test('serializes duplicate invocations at the repository truth boundary', async () => {
    const claimed: number[] = [];
    let locked = Promise.resolve();
    const repository: NotificationRetentionRepository = {
      prune() {
        const current = locked.then(async () => {
          const result = claimed.length === 0 ? 2 : 0;
          claimed.push(result);
          await Promise.resolve();
          return result;
        });
        locked = current.then(() => undefined);
        return current;
      },
    };
    const [first, second] = await Promise.all([
      runNotificationRetentionCleanup(repository, { now: () => fixedNow }),
      runNotificationRetentionCleanup(repository, { now: () => fixedNow }),
    ]);
    expect(first.deletedCount + second.deletedCount).toBe(2);
    expect(claimed).toEqual([2, 0]);
  });

  test('keeps HTTP authorization and response shape while calling the shared processor', async () => {
    const unauthorized = await executeNotificationRetentionCleanupCron(
      new Request('http://localhost/api/cron/notification-retention-cleanup')
    );
    expect(unauthorized.status).toBe(401);

    let calls = 0;
    const repository: NotificationRetentionRepository = {
      async prune() {
        calls += 1;
        return calls === 1 ? 14 : 0;
      },
    };
    const response = await executeNotificationRetentionCleanupCron(
      new Request('http://localhost/api/cron/notification-retention-cleanup', {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      }),
      repository,
      () => fixedNow
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      cutoff: '2026-08-16T12:00:00.000Z',
      deletedCount: 14,
      batches: 1,
    });
    expect(calls).toBe(1);
  });

  test('fails closed for wrong cron, non-Production, disabled, and invalid runtime values', async () => {
    let calls = 0;
    const repository: NotificationRetentionRepository = {
      async prune() { calls += 1; return 0; },
    };
    await handleNotificationRetentionCleanupScheduled(
      { cron: HOME_POPULARITY_SNAPSHOT_CRON }, productionEnvironment, { repository }
    );
    await handleNotificationRetentionCleanupScheduled(
      { cron: NOTIFICATION_RETENTION_CLEANUP_CRON },
      { ...productionEnvironment, CLOUDFLARE_DEPLOYMENT_ENV: 'canary' },
      { repository }
    );
    await handleNotificationRetentionCleanupScheduled(
      { cron: NOTIFICATION_RETENTION_CLEANUP_CRON },
      { ...productionEnvironment, NOTIFICATION_RETENTION_CLEANUP_SCHEDULED_ENABLED: 'false' },
      { repository }
    );
    expect(calls).toBe(0);
    await expect(handleNotificationRetentionCleanupScheduled(
      { cron: NOTIFICATION_RETENTION_CLEANUP_CRON },
      { ...productionEnvironment, NEXT_PUBLIC_SUPABASE_URL: 'https://attacker.invalid' },
      { log: () => undefined }
    )).rejects.toMatchObject({ diagnosticCode: 'invalid_supabase_url' });
  });

  test('uses cold scheduled env directly and rejects redirect/error/malformed responses without leaking data', async () => {
    const logs: Record<string, unknown>[] = [];
    const requests: Array<{ url: string; body: string }> = [];
    const result = await handleNotificationRetentionCleanupScheduled(
      { cron: NOTIFICATION_RETENTION_CLEANUP_CRON },
      productionEnvironment,
      {
        now: () => fixedNow,
        nowMs: () => fixedNow.getTime(),
        log: (entry) => logs.push(entry),
        fetch: async (input, init) => {
          requests.push({ url: String(input), body: String(init?.body) });
          return Response.json(0);
        },
      }
    );
    expect(result).toMatchObject({ status: 'completed', deletedCount: 0 });
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toContain('/rest/v1/rpc/prune_notifications_retention');
    expect(requests[0].body).toContain('p_batch_size');

    for (const fixture of [
      new Response('', { status: 302 }),
      new Response('private provider body', { status: 503 }),
      new Response('<html>private</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    ]) {
      await expect(createCloudflareNotificationRetentionRepository(
        productionEnvironment,
        async () => fixture.clone()
      ).prune('2026-01-01T00:00:00.000Z', 1000)).rejects.toBeInstanceOf(
        NotificationRetentionCleanupError
      );
    }
    expect(JSON.stringify(logs)).not.toContain('private-fixture-service-role');
    expect(JSON.stringify(logs)).not.toContain('private provider body');
  });

  test('routes the three exact cron kinds without cross-execution and isolates daily failures', async () => {
    const calls: string[] = [];
    const options = multiplexerOptions(calls);
    await handleLocallyScheduledEvent({ cron: NOTIFICATION_RETENTION_CLEANUP_CRON }, {}, options);
    expect(calls).toEqual(['retention']);
    calls.length = 0;
    await handleLocallyScheduledEvent({ cron: ADMIN_SUPPORT_UNREAD_ALERTS_CRON }, {}, options);
    expect(calls).toEqual(['admin-support']);
    calls.length = 0;
    await handleLocallyScheduledEvent({ cron: HOME_POPULARITY_SNAPSHOT_CRON }, {}, options);
    expect(calls).toEqual(['translation', 'home']);

    const failureCalls: string[] = [];
    await expect(handleLocallyScheduledEvent(
      { cron: HOME_POPULARITY_SNAPSHOT_CRON }, {}, {
        ...multiplexerOptions(failureCalls),
        runTranslationRecovery: () => { failureCalls.push('translation'); throw new Error('private payload'); },
      }
    )).rejects.toThrow('locally_scheduled_task_failed');
    expect(failureCalls).toEqual(['translation', 'home']);
  });

  test('retires only the GitHub automatic schedule after Cloudflare activation', () => {
    const workflow = readFileSync('.github/workflows/notification-retention-cleanup.yml', 'utf8');
    expect(workflow).not.toMatch(/\n\s*schedule:\s*(?:\n|$)/);
    expect(workflow).not.toContain("- cron: '31 19 * * *'");
    expect(workflow).toMatch(/\n\s*workflow_dispatch:\s*(?:\n|$)/);
    expect(workflow).toContain('/api/cron/notification-retention-cleanup');
  });
});
