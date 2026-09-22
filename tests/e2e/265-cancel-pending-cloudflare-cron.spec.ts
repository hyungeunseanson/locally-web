import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { GET as executeCancelPendingCron } from '../../app/api/cron/cancel-pending/route';
import {
  CANCEL_PENDING_BOOKINGS_CRON,
  CancelPendingBookingsScheduledError,
  handleCancelPendingBookingsScheduled,
} from '../../app/utils/cancelPendingBookingsScheduled';
import { handleLocallyScheduledEvent } from '../../app/utils/cloudflareScheduled';

const productionEnvironment = {
  CLOUDFLARE_DEPLOYMENT_ENV: 'production',
  CANCEL_PENDING_BOOKINGS_SCHEDULED_ENABLED: 'true',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329',
  SUPABASE_SERVICE_ROLE_KEY: 'private-service-role-key',
};

const completedResult = {
  success: true,
  runId: 1,
  outcome: 'no_candidates',
  cancelledCount: 0,
  activeSkippedCount: 0,
  reconciliationRequiredCount: 0,
  alreadyTerminalCount: 0,
  batchCount: 1,
  hasMore: false,
} as const;

function dispatcherOptions(calls: string[]) {
  return {
    dailyCron: '17 19 * * *',
    adminSupportCron: '*/10 * * * *',
    notificationRetentionCron: '31 19 * * *',
    experienceCompletionCron: '23 */2 * * *',
    cancelPendingCron: CANCEL_PENDING_BOOKINGS_CRON,
    runTranslationRecovery: () => calls.push('translation'),
    runHomePopularitySnapshot: () => calls.push('home'),
    runAdminSupportUnreadAlerts: () => calls.push('admin'),
    runNotificationRetentionCleanup: () => calls.push('retention'),
    runExperienceCompletionSync: () => calls.push('experience'),
    runServiceCompletionSync: () => calls.push('service'),
    runCancelPendingBookings: () => calls.push('cancel-pending'),
    log: () => undefined,
  };
}

test.describe('Cancel Pending Bookings Cloudflare Cron', () => {
  test('preserves the authenticated HTTP fallback', async () => {
    const response = await executeCancelPendingCron(
      new Request('https://example.test/api/cron/cancel-pending')
    );
    expect(response.status).toBe(401);
  });

  test('runs only the exact Production Cron when its independent flag is enabled', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const options = {
      createClient: () => ({}) as never,
      runCleanup: async (params: Record<string, unknown>) => {
        calls.push(params);
        return completedResult as never;
      },
      log: () => undefined,
    };

    await handleCancelPendingBookingsScheduled(
      { cron: CANCEL_PENDING_BOOKINGS_CRON }, productionEnvironment, options
    );
    await handleCancelPendingBookingsScheduled(
      { cron: '8,38 * * * *' }, productionEnvironment, options
    );
    await handleCancelPendingBookingsScheduled(
      { cron: CANCEL_PENDING_BOOKINGS_CRON },
      { ...productionEnvironment, CLOUDFLARE_DEPLOYMENT_ENV: 'canary' },
      options
    );
    await handleCancelPendingBookingsScheduled(
      { cron: CANCEL_PENDING_BOOKINGS_CRON },
      { ...productionEnvironment, CANCEL_PENDING_BOOKINGS_SCHEDULED_ENABLED: 'false' },
      options
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ triggerSource: 'cron' });
  });

  test('treats an existing lease as a successful no-op', async () => {
    const logs: Record<string, unknown>[] = [];
    await expect(handleCancelPendingBookingsScheduled(
      { cron: CANCEL_PENDING_BOOKINGS_CRON }, productionEnvironment, {
        createClient: () => ({}) as never,
        runCleanup: async () => ({
          success: false,
          status: 409,
          outcome: 'already_running',
          error: 'private lease detail',
        } as never),
        now: () => 10,
        log: (entry) => logs.push(entry),
      }
    )).resolves.toMatchObject({ status: 'completed', outcome: 'already_running' });
    expect(logs).toEqual([{
      event: 'cancel_pending_bookings_scheduled',
      status: 'completed',
      outcome: 'already_running',
      cancelledCount: 0,
      activeSkippedCount: 0,
      reconciliationRequiredCount: 0,
      alreadyTerminalCount: 0,
      batchCount: 0,
      durationMs: 0,
      diagnosticCode: 'processor_completed',
    }]);
  });

  test('logs only aggregate outcomes on success', async () => {
    const logs: Record<string, unknown>[] = [];
    await handleCancelPendingBookingsScheduled(
      { cron: CANCEL_PENDING_BOOKINGS_CRON }, productionEnvironment, {
        createClient: () => ({}) as never,
        runCleanup: async () => ({
          ...completedResult,
          outcome: 'completed',
          cancelledCount: 2,
          activeSkippedCount: 3,
          reconciliationRequiredCount: 1,
          alreadyTerminalCount: 4,
          batchCount: 2,
        } as never),
        now: () => 20,
        log: (entry) => logs.push(entry),
      }
    );
    expect(logs).toEqual([{
      event: 'cancel_pending_bookings_scheduled',
      status: 'completed',
      outcome: 'completed',
      cancelledCount: 2,
      activeSkippedCount: 3,
      reconciliationRequiredCount: 1,
      alreadyTerminalCount: 4,
      batchCount: 2,
      durationMs: 0,
      diagnosticCode: 'processor_completed',
    }]);
  });

  test('fails closed without exposing booking or provider details', async () => {
    const logs: Record<string, unknown>[] = [];
    await expect(handleCancelPendingBookingsScheduled(
      { cron: CANCEL_PENDING_BOOKINGS_CRON }, productionEnvironment, {
        createClient: () => ({}) as never,
        runCleanup: async () => {
          throw new Error(
            'private-booking-id private-order-id private-customer-id private-tid private-provider-reference raw-provider-body private-service-role-key'
          );
        },
        now: () => 30,
        log: (entry) => logs.push(entry),
      }
    )).rejects.toEqual(expect.objectContaining({
      diagnosticStage: 'processor',
      diagnosticCode: 'pending_cleanup_failed',
    } satisfies Partial<CancelPendingBookingsScheduledError>));

    expect(logs).toEqual([{
      event: 'cancel_pending_bookings_scheduled',
      status: 'failed',
      diagnosticStage: 'processor',
      diagnosticCode: 'pending_cleanup_failed',
      durationMs: 0,
    }]);
    const serialized = JSON.stringify(logs);
    for (const sensitive of [
      'private-booking-id',
      'private-order-id',
      'private-customer-id',
      'private-tid',
      'private-provider-reference',
      'raw-provider-body',
      'private-service-role-key',
    ]) {
      expect(serialized).not.toContain(sensitive);
    }
  });

  test('dispatches the new Cron to only the pending-cleanup task', async () => {
    const calls: string[] = [];
    await expect(handleLocallyScheduledEvent(
      { cron: CANCEL_PENDING_BOOKINGS_CRON }, {}, dispatcherOptions(calls)
    )).resolves.toEqual({ status: 'completed', taskCount: 1 });
    expect(calls).toEqual(['cancel-pending']);
  });

  test('preserves all four existing Cron routes and rejects unknown triggers', async () => {
    const calls: string[] = [];
    const options = dispatcherOptions(calls);
    await handleLocallyScheduledEvent({ cron: '17 19 * * *' }, {}, options);
    expect(calls.splice(0)).toEqual(['translation', 'home']);
    await handleLocallyScheduledEvent({ cron: '*/10 * * * *' }, {}, options);
    expect(calls.splice(0)).toEqual(['admin']);
    await handleLocallyScheduledEvent({ cron: '31 19 * * *' }, {}, options);
    expect(calls.splice(0)).toEqual(['retention']);
    await handleLocallyScheduledEvent({ cron: '23 */2 * * *' }, {}, options);
    expect(calls.splice(0)).toEqual(['experience', 'service']);
    await expect(handleLocallyScheduledEvent(
      { cron: '0 0 1 1 *' }, {}, options
    )).rejects.toThrow('locally_unexpected_scheduled_trigger');
  });

  test('pins the OFF-by-default release and scheduler configuration', () => {
    const policy = JSON.parse(readFileSync(
      'config/cloudflare/cancel-pending-bookings-release-policy.json',
      'utf8'
    ));
    const wrangler = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
    const workflow = readFileSync('.github/workflows/cancel-pending-bookings.yml', 'utf8');
    const worker = readFileSync('cloudflare-worker.ts', 'utf8');

    expect(policy.defaultProductionProfile).toBe('off');
    expect(policy.profiles.off.scheduledEnabled).toBe('false');
    expect(policy.profiles.on.scheduledEnabled).toBe('true');
    expect(wrangler.env.production.vars.CANCEL_PENDING_BOOKINGS_SCHEDULED_ENABLED).toBe('false');
    expect(new Set(wrangler.env.production.triggers.crons)).toEqual(new Set([
      '*/10 * * * *',
      '7,37 * * * *',
      '17 19 * * *',
      '23 */2 * * *',
      '31 19 * * *',
    ]));
    expect(worker).toContain('handleCancelPendingBookingsScheduled');
    expect(workflow).toContain("cron: '7,37 * * * *'");
    expect(workflow).toContain('workflow_dispatch:');
  });
});
