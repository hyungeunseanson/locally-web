import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

import { executeHomePopularitySnapshotCron } from '../../app/api/cron/home-popularity-snapshot/route';
import { handleLocallyScheduledEvent } from '../../app/utils/cloudflareScheduled';
import {
  HOME_POPULARITY_SNAPSHOT_CRON,
  HomePopularitySnapshotError,
  createCloudflareHomePopularitySnapshotRepository,
  handleHomePopularitySnapshotScheduled,
  refreshHomePopularitySnapshot,
  type HomePopularitySnapshotRepository,
} from '../../app/utils/homePopularitySnapshot';

const productionEnvironment = {
  CLOUDFLARE_DEPLOYMENT_ENV: 'production',
  HOME_POPULARITY_SNAPSHOT_SCHEDULED_ENABLED: 'true',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329',
  SUPABASE_SERVICE_ROLE_KEY: 'fixture-service-role',
};

test.describe('Home popularity Cloudflare Cron', () => {
  test('shared processor preserves the single RPC result contract', async () => {
    let calls = 0;
    const repository: HomePopularitySnapshotRepository = {
      async refresh() {
        calls += 1;
        return 7;
      },
    };
    await expect(
      refreshHomePopularitySnapshot(
        repository,
        () => new Date('2026-09-15T10:00:00.000Z')
      )
    ).resolves.toEqual({
      success: true,
      refreshedCount: 7,
      refreshedAt: '2026-09-15T10:00:00.000Z',
    });
    expect(calls).toBe(1);
  });

  test('HTTP fallback retains CRON_SECRET guard and JSON response', async () => {
    const unauthorized = await executeHomePopularitySnapshotCron(
      new Request('https://example.test/api/cron/home-popularity-snapshot')
    );
    expect(unauthorized.status).toBe(401);

    const previous = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'fixture-cron-secret';
    try {
      const response = await executeHomePopularitySnapshotCron(
        new Request('https://example.test/api/cron/home-popularity-snapshot', {
          headers: { authorization: 'Bearer fixture-cron-secret' },
        }),
        { async refresh() { return 3; } }
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        success: true,
        refreshedCount: 3,
      });
    } finally {
      if (previous === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = previous;
    }
  });

  test('cold runtime adapter calls only the exact RPC without exposing credentials', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const repository = createCloudflareHomePopularitySnapshotRepository(
      productionEnvironment,
      async (input, init) => {
        requests.push({ url: String(input), init });
        return new Response('5', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
    );
    await expect(repository.refresh()).resolves.toBe(5);
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(
      'http://127.0.0.1:54329/rest/v1/rpc/refresh_experience_popularity_snapshot'
    );
    expect(requests[0].init?.method).toBe('POST');
    expect(requests[0].init?.redirect).toBe('manual');
    expect(JSON.stringify({ url: requests[0].url })).not.toContain(
      'fixture-service-role'
    );
    expect(() => createCloudflareHomePopularitySnapshotRepository({
      ...productionEnvironment,
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.test/private',
    })).toThrow('invalid_supabase_url');
  });

  test('scheduled refresh is exact-cron, Production-only, and default-off', async () => {
    let refreshes = 0;
    const repository = { async refresh() { refreshes += 1; return 2; } };
    await expect(handleHomePopularitySnapshotScheduled(
      { cron: HOME_POPULARITY_SNAPSHOT_CRON },
      productionEnvironment,
      { repository, log: () => undefined }
    )).resolves.toMatchObject({ status: 'refreshed', refreshedCount: 2 });
    await handleHomePopularitySnapshotScheduled(
      { cron: '18 19 * * *' },
      productionEnvironment,
      { repository }
    );
    await handleHomePopularitySnapshotScheduled(
      { cron: HOME_POPULARITY_SNAPSHOT_CRON },
      { ...productionEnvironment, CLOUDFLARE_DEPLOYMENT_ENV: 'canary' },
      { repository }
    );
    await handleHomePopularitySnapshotScheduled(
      { cron: HOME_POPULARITY_SNAPSHOT_CRON },
      { ...productionEnvironment, HOME_POPULARITY_SNAPSHOT_SCHEDULED_ENABLED: 'false' },
      { repository }
    );
    expect(refreshes).toBe(1);
  });

  test('multiplexer starts both owned tasks and reports either failure after settlement', async () => {
    const calls: string[] = [];
    await expect(handleLocallyScheduledEvent(
      { cron: HOME_POPULARITY_SNAPSHOT_CRON },
      {},
      {
        dailyCron: HOME_POPULARITY_SNAPSHOT_CRON,
        adminSupportCron: '*/10 * * * *',
        notificationRetentionCron: '31 19 * * *',
        experienceCompletionCron: '23 */2 * * *',
        runTranslationRecovery: async () => {
          calls.push('translation');
          throw new Error('private translation response');
        },
        runHomePopularitySnapshot: async () => {
          calls.push('home');
        },
        runAdminSupportUnreadAlerts: async () => calls.push('admin-support'),
        runNotificationRetentionCleanup: async () => calls.push('retention'),
        runExperienceCompletionSync: async () => calls.push('completion'),
        log: () => undefined,
      }
    )).rejects.toThrow('locally_scheduled_task_failed');
    expect(calls).toEqual(['translation', 'home']);

    calls.length = 0;
    await expect(handleLocallyScheduledEvent(
      { cron: HOME_POPULARITY_SNAPSHOT_CRON },
      {},
      {
        dailyCron: HOME_POPULARITY_SNAPSHOT_CRON,
        adminSupportCron: '*/10 * * * *',
        notificationRetentionCron: '31 19 * * *',
        experienceCompletionCron: '23 */2 * * *',
        runTranslationRecovery: async () => calls.push('translation'),
        runHomePopularitySnapshot: async () => {
          calls.push('home');
          throw new Error('private database response');
        },
        runAdminSupportUnreadAlerts: async () => calls.push('admin-support'),
        runNotificationRetentionCleanup: async () => calls.push('retention'),
        runExperienceCompletionSync: async () => calls.push('completion'),
        log: () => undefined,
      }
    )).rejects.toThrow('locally_scheduled_task_failed');
    expect(calls).toEqual(['translation', 'home']);
  });

  test('unknown schedules delegate without running either owned task', async () => {
    const calls: string[] = [];
    await expect(handleLocallyScheduledEvent(
      { cron: '0 0 * * *' },
      {},
      {
        dailyCron: HOME_POPULARITY_SNAPSHOT_CRON,
        adminSupportCron: '*/10 * * * *',
        notificationRetentionCron: '31 19 * * *',
        experienceCompletionCron: '23 */2 * * *',
        runTranslationRecovery: () => calls.push('translation'),
        runHomePopularitySnapshot: () => calls.push('home'),
        runAdminSupportUnreadAlerts: () => calls.push('admin-support'),
        runNotificationRetentionCleanup: () => calls.push('retention'),
        runExperienceCompletionSync: () => calls.push('completion'),
        delegate: () => {
          calls.push('delegate');
          return 'delegated';
        },
      }
    )).resolves.toBe('delegated');
    expect(calls).toEqual(['delegate']);
  });

  test('runtime errors are bounded and do not leak provider bodies or credentials', async () => {
    const logs: Record<string, unknown>[] = [];
    const repository = createCloudflareHomePopularitySnapshotRepository(
      productionEnvironment,
      async () => new Response('private database body fixture-service-role', { status: 503 })
    );
    await expect(handleHomePopularitySnapshotScheduled(
      { cron: HOME_POPULARITY_SNAPSHOT_CRON },
      productionEnvironment,
      { repository, log: (entry) => logs.push(entry) }
    )).rejects.toMatchObject({
      diagnosticStage: 'rpc',
      diagnosticCode: 'rpc_server_error',
      httpStatus: 503,
    } satisfies Partial<HomePopularitySnapshotError>);
    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain('private database body');
    expect(serialized).not.toContain('fixture-service-role');
  });

  test('retires only the GitHub automatic schedule after Production activation', () => {
    const workflow = readFileSync(
      '.github/workflows/home-popularity-snapshot.yml',
      'utf8'
    );
    expect(workflow).not.toMatch(/\n\s*schedule:\s*(?:\n|$)/);
    expect(workflow).not.toContain("- cron: '17 19 * * *'");
    expect(workflow).toMatch(/\n\s*workflow_dispatch:\s*(?:\n|$)/);
    expect(workflow).toContain('/api/cron/home-popularity-snapshot');
  });
});
