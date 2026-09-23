import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { GET as executeExperienceCompletionCron } from '../../app/api/cron/complete-trips/route';
import { handleLocallyScheduledEvent } from '../../app/utils/cloudflareScheduled';
import {
  EXPERIENCE_COMPLETION_SYNC_CRON,
  ExperienceCompletionScheduledError,
  handleExperienceCompletionScheduled,
} from '../../app/utils/experienceCompletionScheduled';
import {
  forceExperienceCompletionSync,
  runExperienceCompletionSync,
} from '../../app/utils/settlementSync/experienceCompletion';

type FixtureState = {
  running: boolean;
  nextRunId: number;
  dueRows: Array<Record<string, unknown>>;
  bookingRows: Array<Record<string, unknown>>;
  calls: string[];
};

function createSettlementClient(state: FixtureState) {
  class Query implements PromiseLike<unknown> {
    private insertValue: Record<string, unknown> | null = null;
    private updateValue: Record<string, unknown> | null = null;
    private hasSelection = false;
    private filters = new Map<string, unknown>();

    constructor(private readonly table: string) {}
    insert(value: Record<string, unknown>) {
      this.insertValue = value;
      return this;
    }
    update(value: Record<string, unknown>) {
      this.updateValue = value;
      return this;
    }
    select() {
      this.hasSelection = true;
      return this;
    }
    eq(column: string, value: unknown) {
      this.filters.set(column, value);
      return this;
    }
    lt() { return this; }
    single() { return Promise.resolve(this.resolve(true)); }
    maybeSingle() { return Promise.resolve(this.resolve(true)); }

    private resolve(single = false) {
      if (this.table === 'bookings') {
        const row = state.bookingRows.find((candidate) =>
          Array.from(this.filters.entries()).every(([column, value]) => candidate[column] === value)
        );
        return { data: row || null, error: null };
      }
      expect(this.table).toBe('admin_job_runs');
      if (this.insertValue) {
        state.calls.push('job-run:start');
        if (state.running) {
          return { data: null, error: { code: '23505', message: 'duplicate key' } };
        }
        state.running = true;
        const id = state.nextRunId++;
        return {
          data: {
            id,
            started_at: this.insertValue.started_at,
            lease_expires_at: this.insertValue.lease_expires_at,
          },
          error: null,
        };
      }
      if (this.updateValue?.status === 'success' || this.updateValue?.status === 'failed') {
        state.calls.push(`job-run:${String(this.updateValue.status)}`);
        state.running = false;
        return { data: single || this.hasSelection ? { id: state.nextRunId - 1 } : null, error: null };
      }
      if (this.updateValue?.status === 'abandoned') {
        state.calls.push('job-run:abandon-expired');
        return { data: null, error: null };
      }
      if (this.updateValue?.lease_expires_at) {
        state.calls.push('job-run:renew');
        return { data: { id: state.nextRunId - 1 }, error: null };
      }
      throw new Error('unexpected fixture query');
    }

    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): PromiseLike<TResult1 | TResult2> {
      return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
    }
  }

  return {
    from(table: string) {
      return new Query(table);
    },
    async rpc(name: string) {
      state.calls.push(`rpc:${name}`);
      if (name === 'list_due_experience_completion_candidates') {
        return { data: state.dueRows, error: null };
      }
      if (name === 'list_due_experience_review_request_candidates') {
        return { data: [], error: null };
      }
      if (name === 'claim_due_review_request_reminders') {
        return { data: [], error: null };
      }
      throw new Error(`unexpected fixture rpc: ${name}`);
    },
  };
}

function createState(
  dueRows: Array<Record<string, unknown>> = [],
  bookingRows: Array<Record<string, unknown>> = []
): FixtureState {
  return { running: false, nextRunId: 1, dueRows, bookingRows, calls: [] };
}

const productionEnvironment = {
  CLOUDFLARE_DEPLOYMENT_ENV: 'production',
  EXPERIENCE_COMPLETION_SCHEDULED_ENABLED: 'true',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329',
  SUPABASE_SERVICE_ROLE_KEY: 'private-fixture-service-role',
  NICEPAY_MID: 'private-fixture-mid',
  NICEPAY_MERCHANT_KEY: 'private-fixture-merchant-key',
};

test.describe('Experience Completion Cloudflare Cron', () => {
  test('keeps the HTTP CRON_SECRET guard before any database work', async () => {
    const response = await executeExperienceCompletionCron(
      new Request('https://example.test/api/cron/complete-trips')
    );
    expect(response.status).toBe(401);
  });

  test('runs refund and bounded review-request reconciliation when no completion is due', async () => {
    const state = createState();
    let completionCalls = 0;
    let refundCalls = 0;
    let reviewCalls = 0;
    let reviewReconciliationCalls = 0;
    const guestEmailInputs: string[][] = [];
    const result = await runExperienceCompletionSync({
      supabaseAdmin: createSettlementClient(state) as never,
      triggerSource: 'cron',
      dependencies: {
        completeBookings: async () => {
          completionCalls += 1;
          return { results: [], failures: [] };
        },
        processSoloGuaranteeRefunds: async () => {
          refundCalls += 1;
          return { processed: 0, refunded: 0, pendingManual: 0, failed: 0, skipped: 0 };
        },
        deliverReviewRequests: async () => {
          reviewCalls += 1;
          return { processedCount: 0, failedCount: 0 };
        },
        deliverGuestReviewRequestEmails: async ({ notificationBookingIds }) => {
          guestEmailInputs.push(notificationBookingIds);
          return { processedCount: notificationBookingIds.length, failedCount: 0 };
        },
        reconcileReviewRequests: async () => {
          reviewReconciliationCalls += 1;
          return {
            candidateCount: 0,
            customerCreatedCount: 1,
            hostCreatedCount: 0,
            failedCount: 0,
            customerNotificationBookingIds: ['reconciled-booking'],
            hostNotificationBookingIds: [],
          };
        },
      },
    });
    expect(result).toMatchObject({
      success: true,
      outcome: 'no_candidates',
      processedCount: 0,
      skippedCount: 0,
    });
    expect({ completionCalls, refundCalls, reviewCalls, reviewReconciliationCalls }).toEqual({
      completionCalls: 0,
      refundCalls: 1,
      reviewCalls: 0,
      reviewReconciliationCalls: 1,
    });
    expect(guestEmailInputs).toEqual([['reconciled-booking']]);
    expect(state.calls).toEqual([
      'job-run:abandon-expired',
      'job-run:start',
      'rpc:list_due_experience_completion_candidates',
      'job-run:renew',
      'rpc:claim_due_review_request_reminders',
      'job-run:renew',
      'job-run:success',
    ]);
  });

  test('reconciles an already-completed force-one target without completing or reviewing it again', async () => {
    const state = createState([], [{
      id: 'completed-booking',
      order_id: 'completed-order',
      user_id: 'private-user-id',
      date: '2026-01-01',
      time: '14:00',
      status: 'completed',
      experiences: { title: 'private title' },
    }]);
    const refundInputs: Array<{
      completedBookingIds: Array<string | number | null | undefined>;
      reconcileCompleted?: boolean;
    }> = [];
    let reviewCalls = 0;

    const result = await forceExperienceCompletionSync({
      supabaseAdmin: createSettlementClient(state) as never,
      triggerSource: 'manual_force_one',
      identifier: 'completed-booking',
      dependencies: {
        processSoloGuaranteeRefunds: async (params) => {
          refundInputs.push(params);
          return { processed: 0, refunded: 0, pendingManual: 0, failed: 0, skipped: 1 };
        },
        deliverReviewRequests: async () => {
          reviewCalls += 1;
          return { processedCount: 0, failedCount: 0 };
        },
      },
    });

    expect(result).toMatchObject({
      success: true,
      outcome: 'already_processed',
      processedCount: 0,
      skippedCount: 1,
    });
    expect(refundInputs).toHaveLength(1);
    expect(refundInputs[0].completedBookingIds).toEqual(['completed-booking']);
    expect(refundInputs[0].reconcileCompleted).toBeFalsy();
    expect(reviewCalls).toBe(0);
    expect(state.calls).not.toContain('rpc:complete_experience_booking_if_due_atomic');
  });

  test('preserves completion, refund, review, and job-run ordering in the actual engine', async () => {
    const state = createState([{
      booking_id: 'private-booking-id',
      order_id: 'private-order-id',
      user_id: 'private-user-id',
      date: '2026-01-01',
      time: '09:00',
      status: 'PAID',
      experience_title: 'private title',
    }]);
    const sideEffects: string[] = [];
    const result = await runExperienceCompletionSync({
      supabaseAdmin: createSettlementClient(state) as never,
      triggerSource: 'cron',
      dependencies: {
        completeBookings: async (_client, ids) => {
          sideEffects.push(`complete:${ids.length}`);
          return {
            results: [{
              bookingId: ids[0], orderId: null, userId: null,
              alreadyProcessed: false, notDue: false, completed: true,
              notificationCreated: true,
            }],
            failures: [],
          };
        },
        processSoloGuaranteeRefunds: async ({ completedBookingIds }) => {
          sideEffects.push(`refund:${completedBookingIds.length}`);
          return { processed: 1, refunded: 1, pendingManual: 0, failed: 0, skipped: 0 };
        },
        deliverReviewRequests: async ({ completedBookingIds }) => {
          sideEffects.push(`review:${completedBookingIds.length}`);
          return { processedCount: 1, failedCount: 0 };
        },
        deliverGuestReviewRequestEmails: async ({ notificationBookingIds }) => {
          sideEffects.push(`guest-email:${notificationBookingIds.length}`);
          return { processedCount: 1, failedCount: 0 };
        },
      },
    });
    expect(result).toMatchObject({ success: true, outcome: 'completed', processedCount: 1 });
    expect(sideEffects).toEqual(['complete:1', 'refund:1', 'review:1', 'guest-email:1']);
    expect(state.calls.at(-2)).toBe('job-run:renew');
    expect(state.calls.at(-1)).toBe('job-run:success');
  });

  test('does not email when completion did not create a new customer review request', async () => {
    const state = createState([{
      booking_id: 'already-notified-booking',
      date: '2026-01-01',
      time: '09:00',
      status: 'PAID',
    }]);
    let guestEmailCalls = 0;
    const result = await runExperienceCompletionSync({
      supabaseAdmin: createSettlementClient(state) as never,
      triggerSource: 'cron',
      dependencies: {
        completeBookings: async () => ({
          results: [{
            bookingId: 'already-notified-booking', orderId: null, userId: 'guest-1',
            alreadyProcessed: false, notDue: false, completed: true,
            notificationCreated: false,
          }],
          failures: [],
        }),
        processSoloGuaranteeRefunds: async () => ({
          processed: 0, refunded: 0, pendingManual: 0, failed: 0, skipped: 1,
        }),
        deliverReviewRequests: async () => ({ processedCount: 0, failedCount: 0 }),
        deliverGuestReviewRequestEmails: async () => {
          guestEmailCalls += 1;
          return { processedCount: 0, failedCount: 0 };
        },
      },
    });
    expect(result).toMatchObject({ success: true, outcome: 'completed' });
    expect(guestEmailCalls).toBe(0);
  });

  test('uses the database lease to make duplicate scheduled invocations no-op', async () => {
    const state = createState([{
      booking_id: 'private-booking-id', date: '2026-01-01', time: '09:00', status: 'PAID',
    }]);
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const completeBookings = async (_client: unknown, ids: string[]) => {
      await held;
      return {
        results: [{
          bookingId: ids[0], orderId: null, userId: null,
          alreadyProcessed: false, notDue: false, completed: true,
          notificationCreated: true,
        }],
        failures: [],
      };
    };
    const dependencies = {
      completeBookings: completeBookings as never,
      processSoloGuaranteeRefunds: async () => ({ processed: 0, refunded: 0, pendingManual: 0, failed: 0, skipped: 1 }),
      deliverReviewRequests: async () => ({ processedCount: 0, failedCount: 0 }),
      deliverGuestReviewRequestEmails: async () => ({ processedCount: 0, failedCount: 0 }),
    };
    const first = runExperienceCompletionSync({
      supabaseAdmin: createSettlementClient(state) as never,
      triggerSource: 'cron',
      dependencies,
    });
    await expect.poll(() => state.running).toBe(true);
    const second = await runExperienceCompletionSync({
      supabaseAdmin: createSettlementClient(state) as never,
      triggerSource: 'cron',
      dependencies,
    });
    expect(second).toMatchObject({ success: false, outcome: 'already_running' });
    release();
    await expect(first).resolves.toMatchObject({ success: true, processedCount: 1 });
  });

  test('is exact-cron, Production-only, independent, and fail-closed', async () => {
    let calls = 0;
    const options = {
      createClient: () => ({}) as never,
      runSync: async () => {
        calls += 1;
        return {
          success: true as const,
          runId: 1,
          outcome: 'no_candidates' as const,
          processedCount: 0,
          skippedCount: 0,
        };
      },
      dependencies: {},
      log: () => undefined,
    };
    await handleExperienceCompletionScheduled(
      { cron: EXPERIENCE_COMPLETION_SYNC_CRON }, productionEnvironment, options
    );
    await handleExperienceCompletionScheduled(
      { cron: '24 */2 * * *' }, productionEnvironment, options
    );
    await handleExperienceCompletionScheduled(
      { cron: EXPERIENCE_COMPLETION_SYNC_CRON },
      { ...productionEnvironment, CLOUDFLARE_DEPLOYMENT_ENV: 'canary' },
      options
    );
    await handleExperienceCompletionScheduled(
      { cron: EXPERIENCE_COMPLETION_SYNC_CRON },
      { ...productionEnvironment, EXPERIENCE_COMPLETION_SCHEDULED_ENABLED: 'false' },
      options
    );
    expect(calls).toBe(1);
  });

  test('keeps scheduled logs aggregate-only and sanitizes failures', async () => {
    const logs: Record<string, unknown>[] = [];
    await expect(handleExperienceCompletionScheduled(
      { cron: EXPERIENCE_COMPLETION_SYNC_CRON }, productionEnvironment, {
        createClient: () => ({}) as never,
        runSync: async () => {
          throw new Error('private-booking-id private title private-fixture-service-role');
        },
        dependencies: {},
        createInvocationId: () => 'invocation-1',
        now: () => 10,
        log: (entry) => logs.push(entry),
      }
    )).rejects.toThrow();
    expect(logs).toEqual([{
      event: 'experience_completion_scheduled',
      status: 'failed',
      invocationId: 'invocation-1',
      diagnosticStage: 'processor',
      diagnosticCode: 'completion_sync_failed',
      durationMs: 0,
    }]);
    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain('private-booking-id');
    expect(serialized).not.toContain('private title');
    expect(serialized).not.toContain('private-fixture-service-role');
  });

  test('routes only the completion cron and preserves all existing cron handlers', async () => {
    const calls: string[] = [];
    const options = {
      dailyCron: '17 19 * * *',
      adminSupportCron: '*/10 * * * *',
      notificationRetentionCron: '31 19 * * *',
      experienceCompletionCron: EXPERIENCE_COMPLETION_SYNC_CRON,
      runTranslationRecovery: () => calls.push('translation'),
      runHomePopularitySnapshot: () => calls.push('home'),
      runAdminSupportUnreadAlerts: () => calls.push('admin'),
      runNotificationRetentionCleanup: () => calls.push('retention'),
      runExperienceCompletionSync: () => calls.push('completion'),
      runServiceCompletionSync: () => calls.push('service'),
      log: () => undefined,
    };
    await handleLocallyScheduledEvent({ cron: EXPERIENCE_COMPLETION_SYNC_CRON }, {}, options);
    expect(calls).toEqual(['completion', 'service']);
    calls.length = 0;
    await handleLocallyScheduledEvent({ cron: '17 19 * * *' }, {}, options);
    expect(calls).toEqual(['translation', 'home']);
    calls.length = 0;
    await handleLocallyScheduledEvent({ cron: '*/10 * * * *' }, {}, options);
    expect(calls).toEqual(['admin']);
    calls.length = 0;
    await handleLocallyScheduledEvent({ cron: '31 19 * * *' }, {}, options);
    expect(calls).toEqual(['retention']);
  });

  test('pins the current database truth, lease, due timezone, and side-effect ordering', () => {
    const dueMigration = readFileSync(
      'docs/migrations/v3_40_16_experience_completion_due_kst.sql',
      'utf8'
    );
    const completionMigration = readFileSync(
      'docs/migrations/v3_40_29_experience_completion_host_guest_review_request.sql',
      'utf8'
    );
    const jobMigration = readFileSync('docs/migrations/v3_40_13_admin_job_runs.sql', 'utf8');
    const engine = readFileSync('app/utils/settlementSync/experienceCompletion.ts', 'utf8');
    const jobRuns = readFileSync('app/utils/settlementSync/jobRuns.ts', 'utf8');
    expect(dueMigration).toContain("b.status IN ('PAID', 'confirmed')");
    expect(dueMigration).toContain("AT TIME ZONE 'Asia/Seoul'");
    expect(dueMigration).toContain('ORDER BY due_at_kst_utc ASC');
    expect(completionMigration).toContain('FOR UPDATE');
    expect(completionMigration).toContain("SET status = 'completed'");
    expect(completionMigration).toContain("type = 'review_request'");
    expect(completionMigration).toContain("type = 'guest_review_request'");
    expect(jobMigration).toContain('admin_job_runs_running_job_name_idx');
    expect(jobRuns).toContain('const DEFAULT_LEASE_SECONDS = 120');
    expect(jobRuns).toContain('const DEFAULT_RUNNING_STALE_MINUTES = 15');
    expect(jobRuns).toContain('const DEFAULT_DELAY_WARNING_MINUTES = 120');
    expect(engine.indexOf('const completionBatch = await completeBookings')).toBeGreaterThanOrEqual(0);
  });

  test('retires the GitHub automatic schedule but keeps the manual HTTP fallback', () => {
    const workflow = readFileSync('.github/workflows/complete-trips.yml', 'utf8');
    expect(workflow).not.toMatch(/\n\s*schedule:\s*(?:\n|$)/);
    expect(workflow).not.toContain("- cron: '23 */2 * * *'");
    expect(workflow).toMatch(/\n\s*workflow_dispatch:\s*(?:\n|$)/);
    expect(workflow).toContain('/api/cron/complete-trips');
  });

  test('maps processor failures to bounded scheduled diagnostics', async () => {
    await expect(handleExperienceCompletionScheduled(
      { cron: EXPERIENCE_COMPLETION_SYNC_CRON }, productionEnvironment, {
        createClient: () => ({}) as never,
        runSync: async () => ({
          success: false as const,
          status: 503 as const,
          error: 'private provider body',
        }),
        dependencies: {},
        log: () => undefined,
      }
    )).rejects.toMatchObject({
      diagnosticStage: 'processor',
      diagnosticCode: 'settlement_infrastructure_unavailable',
    } satisfies Partial<ExperienceCompletionScheduledError>);
  });
});
