import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { GET as executeServiceCompletionCron } from '../../app/api/cron/complete-services/route';
import { handleLocallyScheduledEvent } from '../../app/utils/cloudflareScheduled';
import {
  SERVICE_COMPLETION_SYNC_CRON,
  handleServiceCompletionScheduled,
} from '../../app/utils/serviceCompletionScheduled';
import { runServiceCompletionSync } from '../../app/utils/settlementSync/serviceCompletion';

const productionEnvironment = {
  CLOUDFLARE_DEPLOYMENT_ENV: 'production',
  SERVICE_COMPLETION_SCHEDULED_ENABLED: 'true',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329',
  SUPABASE_SERVICE_ROLE_KEY: 'private-service-role-key',
};

function createProcessorClient(calls: string[], alreadyRunning = false) {
  class Query implements PromiseLike<unknown> {
    private inserted = false;
    private updateValue: Record<string, unknown> | null = null;

    constructor(private readonly table: string) {}
    select() { return this; }
    not() { return this; }
    lte() { return this; }
    in() { return this; }
    eq() { return this; }
    lt() { return this; }
    insert() { this.inserted = true; return this; }
    update(value: Record<string, unknown>) { this.updateValue = value; return this; }
    single() { return Promise.resolve(this.resolve()); }
    maybeSingle() { return Promise.resolve(this.resolve()); }

    private resolve() {
      if (this.table === 'service_requests') {
        return {
          data: [{
            id: 'request-fixture',
            service_end_at: '2026-01-01T00:00:00.000Z',
            status: 'matched',
            selected_host_id: 'host-fixture',
          }],
          error: null,
        };
      }
      if (this.table === 'service_bookings') {
        return {
          data: [{
            id: 'booking-fixture',
            order_id: 'order-fixture',
            request_id: 'request-fixture',
            status: 'confirmed',
            host_id: 'host-fixture',
          }],
          error: null,
        };
      }
      expect(this.table).toBe('admin_job_runs');
      if (this.inserted) {
        calls.push('lease:start');
        if (alreadyRunning) {
          return { data: null, error: { code: '23505', message: 'duplicate key' } };
        }
        return {
          data: {
            id: 1,
            started_at: '2026-01-01T00:00:00.000Z',
            lease_expires_at: '2026-01-01T00:02:00.000Z',
          },
          error: null,
        };
      }
      if (this.updateValue?.status === 'abandoned') {
        calls.push('lease:abandon-expired');
        return { data: null, error: null };
      }
      if (this.updateValue?.status === 'success') {
        calls.push('lease:success');
        return { data: { id: 1 }, error: null };
      }
      if (this.updateValue?.lease_expires_at) {
        calls.push('lease:renew');
        return { data: { id: 1 }, error: null };
      }
      throw new Error('unexpected processor fixture query');
    }

    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): PromiseLike<TResult1 | TResult2> {
      return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
    }
  }

  return {
    from(table: string) { return new Query(table); },
    rpc(name: string) {
      expect(name).toBe('complete_service_concierge_booking_if_due_atomic');
      calls.push(`rpc:${name}`);
      return {
        maybeSingle: async () => ({
          data: {
            booking_id: 'booking-fixture',
            order_id: 'order-fixture',
            request_id: 'request-fixture',
            host_id: 'host-fixture',
            service_end_at: '2026-01-01T00:00:00.000Z',
            already_processed: false,
            not_due: false,
            completed: true,
          },
          error: null,
        }),
      };
    },
  };
}

test.describe('Service Completion Cloudflare Cron', () => {
  test('preserves the manual HTTP fallback guard', async () => {
    const response = await executeServiceCompletionCron(
      new Request('https://example.test/api/cron/complete-services')
    );
    expect(response.status).toBe(401);
  });

  test('reuses the Service processor and admin_job_runs lease for due completion', async () => {
    const calls: string[] = [];
    const result = await runServiceCompletionSync({
      supabaseAdmin: createProcessorClient(calls) as never,
      triggerSource: 'cron',
    });
    expect(result).toMatchObject({
      success: true,
      outcome: 'completed',
      processedCount: 1,
      skippedCount: 0,
    });
    expect(calls).toEqual([
      'lease:abandon-expired',
      'lease:start',
      'lease:renew',
      'lease:renew',
      'rpc:complete_service_concierge_booking_if_due_atomic',
      'lease:success',
    ]);
  });

  test('makes a competing processor invocation an idempotent lease no-op', async () => {
    const calls: string[] = [];
    const result = await runServiceCompletionSync({
      supabaseAdmin: createProcessorClient(calls, true) as never,
      triggerSource: 'cron',
    });
    expect(result).toMatchObject({
      success: false,
      status: 409,
      outcome: 'already_running',
      processedCount: 0,
      skippedCount: 0,
    });
    expect(calls).toEqual(['lease:abandon-expired', 'lease:start']);
  });

  test('pins the current payment, assignment, and atomic completion database contract', () => {
    const migration = readFileSync(
      'supabase/migrations/20260912050655_service_concierge_assignment.sql',
      'utf8'
    );
    const createStart = migration.indexOf('CREATE OR REPLACE FUNCTION public.create_service_concierge_request_atomic');
    const paymentStart = migration.indexOf('CREATE OR REPLACE FUNCTION public.confirm_service_concierge_payment_atomic');
    const assignmentStart = migration.indexOf('CREATE OR REPLACE FUNCTION public.assign_service_concierge_host_atomic');
    const completionStart = migration.indexOf('CREATE OR REPLACE FUNCTION public.complete_service_concierge_booking_if_due_atomic');
    const refundStart = migration.indexOf('CREATE OR REPLACE FUNCTION public.begin_service_refund_operation_atomic');
    const createRpc = migration.slice(createStart, paymentStart);
    const paymentRpc = migration.slice(paymentStart, assignmentStart);
    const assignmentRpc = migration.slice(assignmentStart, completionStart);
    const completionRpc = migration.slice(completionStart, refundStart);

    expect(createRpc).toContain("'pending_payment'");
    expect(createRpc).toContain("'PENDING'");
    expect(paymentRpc).toContain("SET status = 'PAID'");
    expect(paymentRpc).toContain("SET status = 'assigning'");
    expect(assignmentRpc).toContain("SET status = 'matched', selected_host_id = p_host_id");
    expect(assignmentRpc).toContain("SET status = 'confirmed', host_id = p_host_id");
    expect(assignmentRpc).toContain('host_payout_amount = v_payout');
    expect(assignmentRpc).toContain('INSERT INTO public.service_assignment_history');
    expect(assignmentRpc).toContain("v_request.user_id, p_host_id, NULL, p_request_id, v_summary, 'general'");
    expect(completionRpc.match(/FOR UPDATE/g)).toHaveLength(2);
    expect(completionRpc).toContain('now() < v_request.service_end_at');
    expect(completionRpc).toContain('v_booking.host_id IS NULL OR v_booking.host_payout_amount IS NULL');
    expect(completionRpc).toContain("v_booking.status NOT IN ('confirmed', 'completed')");
    expect(completionRpc).toContain("v_request.status NOT IN ('matched', 'completed')");
    expect(completionRpc).toContain("UPDATE public.service_bookings SET status = 'completed'");
    expect(completionRpc).toContain("UPDATE public.service_requests SET status = 'completed'");
    expect(completionRpc).toContain('NOT v_changed, FALSE, v_changed');
  });

  test('runs only the exact Production schedule when its independent flag is enabled', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const options = {
      createClient: () => ({}) as never,
      runSync: async (params: Record<string, unknown>) => {
        calls.push(params);
        return {
          success: true,
          outcome: 'no_candidates',
          processedCount: 0,
          skippedCount: 0,
        } as never;
      },
      log: () => undefined,
    };

    await handleServiceCompletionScheduled(
      { cron: SERVICE_COMPLETION_SYNC_CRON }, productionEnvironment, options
    );
    await handleServiceCompletionScheduled(
      { cron: '24 */2 * * *' }, productionEnvironment, options
    );
    await handleServiceCompletionScheduled(
      { cron: SERVICE_COMPLETION_SYNC_CRON },
      { ...productionEnvironment, CLOUDFLARE_DEPLOYMENT_ENV: 'canary' },
      options
    );
    await handleServiceCompletionScheduled(
      { cron: SERVICE_COMPLETION_SYNC_CRON },
      { ...productionEnvironment, SERVICE_COMPLETION_SCHEDULED_ENABLED: 'false' },
      options
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ triggerSource: 'cron' });
  });

  test('treats the existing lease already_running outcome as a normal no-op', async () => {
    const logs: Record<string, unknown>[] = [];
    await expect(handleServiceCompletionScheduled(
      { cron: SERVICE_COMPLETION_SYNC_CRON }, productionEnvironment, {
        createClient: () => ({}) as never,
        runSync: async () => ({
          success: false,
          status: 409,
          outcome: 'already_running',
          processedCount: 0,
          skippedCount: 0,
          error: 'private lease detail',
        } as never),
        now: () => 10,
        log: (entry) => logs.push(entry),
      }
    )).resolves.toMatchObject({ status: 'completed', outcome: 'already_running' });
    expect(logs).toEqual([{
      event: 'service_completion_scheduled',
      status: 'completed',
      outcome: 'already_running',
      processedCount: 0,
      skippedCount: 0,
      durationMs: 0,
      diagnosticCode: 'processor_completed',
    }]);
  });

  test('fails closed with aggregate-only diagnostics and no sensitive values', async () => {
    const logs: Record<string, unknown>[] = [];
    await expect(handleServiceCompletionScheduled(
      { cron: SERVICE_COMPLETION_SYNC_CRON }, productionEnvironment, {
        createClient: () => ({}) as never,
        runSync: async () => {
          throw new Error(
            'private-booking-id private-order-id private-request-id private-host-id private-service-role-key raw-provider-body'
          );
        },
        now: () => 20,
        log: (entry) => logs.push(entry),
      }
    )).rejects.toEqual(expect.objectContaining({
      diagnosticStage: 'processor',
      diagnosticCode: 'completion_sync_failed',
    }));

    expect(logs).toEqual([{
      event: 'service_completion_scheduled',
      status: 'failed',
      diagnosticStage: 'processor',
      diagnosticCode: 'completion_sync_failed',
      durationMs: 0,
    }]);
    const serialized = JSON.stringify(logs);
    for (const secret of [
      'private-booking-id',
      'private-order-id',
      'private-request-id',
      'private-host-id',
      'private-service-role-key',
      'raw-provider-body',
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  test('runs Experience and Service independently on the shared trigger', async () => {
    const createOptions = (calls: string[], failure?: 'experience' | 'service') => ({
      dailyCron: '17 19 * * *',
      adminSupportCron: '*/10 * * * *',
      notificationRetentionCron: '31 19 * * *',
      experienceCompletionCron: SERVICE_COMPLETION_SYNC_CRON,
      runTranslationRecovery: () => calls.push('translation'),
      runHomePopularitySnapshot: () => calls.push('home'),
      runAdminSupportUnreadAlerts: () => calls.push('admin'),
      runNotificationRetentionCleanup: () => calls.push('retention'),
      runExperienceCompletionSync: async () => {
        calls.push('experience');
        if (failure === 'experience') throw new Error('private experience failure');
      },
      runServiceCompletionSync: async () => {
        calls.push('service');
        if (failure === 'service') throw new Error('private service failure');
      },
      log: () => undefined,
    });

    const successCalls: string[] = [];
    await expect(handleLocallyScheduledEvent(
      { cron: SERVICE_COMPLETION_SYNC_CRON }, {}, createOptions(successCalls)
    )).resolves.toEqual({ status: 'completed', taskCount: 2 });
    expect(successCalls).toEqual(['experience', 'service']);

    for (const failure of ['experience', 'service'] as const) {
      const calls: string[] = [];
      await expect(handleLocallyScheduledEvent(
        { cron: SERVICE_COMPLETION_SYNC_CRON }, {}, createOptions(calls, failure)
      )).rejects.toThrow('locally_scheduled_task_failed');
      expect(calls).toEqual(['experience', 'service']);
    }
  });

  test('preserves every existing non-completion Cron route', async () => {
    const calls: string[] = [];
    const options = {
      dailyCron: '17 19 * * *',
      adminSupportCron: '*/10 * * * *',
      notificationRetentionCron: '31 19 * * *',
      experienceCompletionCron: SERVICE_COMPLETION_SYNC_CRON,
      runTranslationRecovery: () => calls.push('translation'),
      runHomePopularitySnapshot: () => calls.push('home'),
      runAdminSupportUnreadAlerts: () => calls.push('admin'),
      runNotificationRetentionCleanup: () => calls.push('retention'),
      runExperienceCompletionSync: () => calls.push('experience'),
      runServiceCompletionSync: () => calls.push('service'),
      log: () => undefined,
    };

    await handleLocallyScheduledEvent({ cron: '17 19 * * *' }, {}, options);
    expect(calls.splice(0)).toEqual(['translation', 'home']);
    await handleLocallyScheduledEvent({ cron: '*/10 * * * *' }, {}, options);
    expect(calls.splice(0)).toEqual(['admin']);
    await handleLocallyScheduledEvent({ cron: '31 19 * * *' }, {}, options);
    expect(calls.splice(0)).toEqual(['retention']);
  });
});
