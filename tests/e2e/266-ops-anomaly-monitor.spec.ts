import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import {
  loadDatabaseOpsAnomalies,
  loadQueueOpsAnomaly,
  OpsAnomalyCollectionError,
} from '@/app/utils/opsAnomalyMonitor/checks';
import {
  OPS_ANOMALY_MONITOR_CRON,
  OPS_ANOMALY_THRESHOLDS,
} from '@/app/utils/opsAnomalyMonitor/config';
import {
  planOpsAnomalyNotifications,
  runOpsAnomalyMonitor,
} from '@/app/utils/opsAnomalyMonitor/runOpsAnomalyMonitor';
import type { OpsAnomaly } from '@/app/utils/opsAnomalyMonitor/types';
import {
  handleOpsAnomalyMonitorScheduled,
  OpsAnomalyMonitorScheduledError,
} from '@/app/utils/opsAnomalyMonitorScheduled';
import { handleLocallyScheduledEvent } from '@/app/utils/cloudflareScheduled';

const observedAt = new Date('2026-09-22T16:00:00.000Z');
const migrationPath = 'supabase/migrations/20260922150728_ops_anomaly_monitor_snapshot.sql';

const productionEnvironment = {
  CLOUDFLARE_DEPLOYMENT_ENV: 'production',
  OPS_ANOMALY_MONITOR_SCHEDULED_ENABLED: 'true',
  CLOUDFLARE_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
  OPS_ANOMALY_MONITOR_CLOUDFLARE_API_TOKEN: 'private-queue-read-token',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329',
  SUPABASE_SERVICE_ROLE_KEY: 'private-service-role-key',
};

const completedResult = {
  success: true,
  runId: 1,
  outcome: 'no_anomalies',
  anomalyCount: 0,
  diagnosticCount: 0,
  alertCount: 0,
  emailCount: 0,
  emailFailureCount: 0,
  suppressedCount: 0,
  severityCounts: { info: 0, warning: 0, critical: 0 },
} as const;

function anomaly(
  diagnosticCode: OpsAnomaly['diagnosticCode'],
  severity: OpsAnomaly['severity'] = 'critical',
  count = 1
): OpsAnomaly {
  return {
    diagnosticCode,
    severity,
    count,
    oldestObservedAt: '2026-09-22T15:00:00.000Z',
    aggregateDetails: {},
  };
}

function queueFetch(params: {
  mainCount?: number;
  dlqCount?: number;
  oldestMainAt?: string;
  calls: Array<{ url: string; init?: RequestInit }>;
}) {
  const queues = [
    ['media-main', 'locally-public-experience-media-mirror-production'],
    ['media-dlq', 'locally-public-experience-media-mirror-dlq-production'],
    ['translation-main', 'locally-experience-translation-production'],
    ['translation-dlq', 'locally-experience-translation-dlq-production'],
  ];
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    params.calls.push({ url, init });
    if (url.endsWith('/queues?per_page=100')) {
      return Response.json({
        success: true,
        result: queues.map(([queue_id, queue_name]) => ({ queue_id, queue_name })),
      });
    }
    const isDlq = url.includes('-dlq/metrics');
    const isMain = url.includes('-main/metrics');
    return Response.json({
      success: true,
      result: {
        backlog_count: isDlq ? (params.dlqCount ?? 0) : (params.mainCount ?? 0),
        oldest_message_timestamp_ms: isMain && params.oldestMainAt
          ? new Date(params.oldestMainAt).getTime()
          : 0,
      },
    });
  };
}

function createProcessorClient(options: {
  previousDetails?: Record<string, unknown> | null;
  alreadyRunning?: boolean;
  calls: string[];
  updates?: Record<string, unknown>[];
}) {
  class Query implements PromiseLike<unknown> {
    private inserted = false;
    private updated: Record<string, unknown> | null = null;
    private selected = '';

    insert() { this.inserted = true; return this; }
    update(value: Record<string, unknown>) {
      this.updated = value;
      options.updates?.push(value);
      return this;
    }
    select(value = '') { this.selected = value; return this; }
    eq() { return this; }
    lt() { return this; }
    order() { return this; }
    limit() { return this; }
    single() { return Promise.resolve(this.resolve()); }
    maybeSingle() { return Promise.resolve(this.resolve()); }

    private resolve() {
      if (this.inserted) {
        options.calls.push('lease:start');
        if (options.alreadyRunning) {
          return { data: null, error: { code: '23505', message: 'duplicate key' } };
        }
        return {
          data: {
            id: 8,
            started_at: observedAt.toISOString(),
            lease_expires_at: '2026-09-22T16:02:00.000Z',
          },
          error: null,
        };
      }
      if (this.updated?.status === 'abandoned') {
        options.calls.push('lease:abandon');
        return { data: null, error: null };
      }
      if (this.updated?.status === 'success') {
        options.calls.push('lease:success');
        return { data: { id: 8 }, error: null };
      }
      if (this.updated?.status === 'failed') {
        options.calls.push('lease:failed');
        return { data: { id: 8 }, error: null };
      }
      if (this.updated?.lease_expires_at) {
        options.calls.push('lease:renew');
        return { data: { id: 8 }, error: null };
      }
      if (this.selected === 'details') {
        options.calls.push('state:read');
        return { data: options.previousDetails == null ? null : { details: options.previousDetails }, error: null };
      }
      throw new Error('Unexpected admin_job_runs query');
    }

    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): PromiseLike<TResult1 | TResult2> {
      return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
    }
  }

  return { from: () => new Query() };
}

test.describe('Ops Anomaly Monitor', () => {
  test('uses a service-role-only aggregate snapshot with no business mutation', () => {
    const migration = readFileSync(migrationPath, 'utf8');
    const body = migration.match(/AS \$function\$([\s\S]*?)\$function\$;/)?.[1] ?? '';

    expect(migration).toContain('FUNCTION public.get_ops_anomaly_snapshot');
    expect(migration).toContain('LANGUAGE sql');
    expect(migration).toContain('STABLE');
    expect(migration).toContain('SECURITY INVOKER');
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.get_ops_anomaly_snapshot\([\s\S]*FROM PUBLIC, anon, authenticated/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_ops_anomaly_snapshot\([\s\S]*TO service_role/);
    expect(body).not.toMatch(/\b(?:insert|update|delete)\s+/i);
    expect(body).not.toMatch(/\b(?:perform|call)\s+/i);
  });

  test('maps zero, one, and multiple aggregate database anomalies with fixed thresholds', async () => {
    const rows = [
      {
        diagnostic_code: 'payment_reconciliation_required',
        anomaly_count: 1,
        oldest_observed_at: '2026-09-22T14:00:00.000Z',
        aggregate_details: {},
      },
      {
        diagnostic_code: 'job_stale_or_failed',
        anomaly_count: '2',
        oldest_observed_at: '2026-09-22T13:00:00.000Z',
        aggregate_details: { stale: 1, failed: 1 },
      },
    ];
    let rpcArguments: Record<string, unknown> | undefined;
    const client = {
      rpc: async (_name: string, args: Record<string, unknown>) => {
        rpcArguments = args;
        return { data: rows, error: null };
      },
    };
    const result = await loadDatabaseOpsAnomalies({
      supabaseAdmin: client as never,
      observedAt,
    });

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.count)).toEqual([1, 2]);
    expect(result[1].aggregateDetails).toEqual({ stale: 1, failed: 1 });
    expect(rpcArguments).toEqual({
      p_observed_at: observedAt.toISOString(),
      p_claim_overdue_minutes: OPS_ANOMALY_THRESHOLDS.paymentClaimOverdueMinutes,
      p_refund_stale_minutes: OPS_ANOMALY_THRESHOLDS.serviceRefundStaleMinutes,
      p_payout_long_hold_days: OPS_ANOMALY_THRESHOLDS.payoutLongHoldDays,
      p_experience_job_missing_minutes: OPS_ANOMALY_THRESHOLDS.experienceJobMissingMinutes,
      p_service_job_missing_minutes: OPS_ANOMALY_THRESHOLDS.serviceJobMissingMinutes,
      p_cancel_pending_job_missing_minutes: OPS_ANOMALY_THRESHOLDS.cancelPendingJobMissingMinutes,
    });

    await expect(loadDatabaseOpsAnomalies({
      supabaseAdmin: { rpc: async () => ({ data: [], error: null }) } as never,
      observedAt,
    })).resolves.toEqual([]);
  });

  test('reads Queue metrics with GET only and classifies count and age boundaries', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const result = await loadQueueOpsAnomaly({
      runtime: productionEnvironment,
      observedAt,
      fetchImplementation: queueFetch({
        mainCount: 5,
        dlqCount: 1,
        oldestMainAt: '2026-09-22T15:45:00.000Z',
        calls,
      }) as typeof fetch,
    });

    expect(result).toMatchObject({
      diagnosticCode: 'queue_or_dlq_backlog',
      severity: 'warning',
      count: 12,
      oldestObservedAt: '2026-09-22T15:45:00.000Z',
      aggregateDetails: {
        main_backlog_count: 10,
        dlq_backlog_count: 2,
        oldest_main_age_minutes: 15,
      },
    });
    expect(calls).toHaveLength(5);
    expect(calls.every((call) => call.init?.method === 'GET')).toBe(true);
    expect(calls.every((call) => call.url.endsWith('/metrics') || call.url.endsWith('/queues?per_page=100'))).toBe(true);
    expect(JSON.stringify(calls)).not.toMatch(/receive|ack|retry|purge|delete|replay/i);
  });

  test('classifies missing Queue runtime bindings without exposing their values', async () => {
    await expect(loadQueueOpsAnomaly({
      runtime: { ...productionEnvironment, CLOUDFLARE_ACCOUNT_ID: '' },
      observedAt,
    })).rejects.toEqual(expect.objectContaining({
      diagnosticCode: 'ops_queue_account_id_missing',
    } satisfies Partial<OpsAnomalyCollectionError>));

    await expect(loadQueueOpsAnomaly({
      runtime: { ...productionEnvironment, OPS_ANOMALY_MONITOR_CLOUDFLARE_API_TOKEN: '' },
      observedAt,
    })).rejects.toEqual(expect.objectContaining({
      diagnosticCode: 'ops_queue_token_missing',
    } satisfies Partial<OpsAnomalyCollectionError>));
  });

  test('bounds inventory HTTP and Cloudflare API diagnostics', async () => {
    for (const status of [401, 403, 404, 429, 500]) {
      const fetchImplementation = async () => Response.json(
        { success: false, result: null, errors: [] },
        { status }
      );
      await expect(loadQueueOpsAnomaly({
        runtime: productionEnvironment,
        observedAt,
        fetchImplementation: fetchImplementation as typeof fetch,
      })).rejects.toEqual(expect.objectContaining({
        diagnosticCode: `ops_queue_inventory_http_${status === 500 ? 'other' : status}`,
        httpStatus: status,
      } satisfies Partial<OpsAnomalyCollectionError>));
    }

    const privateBody = 'private-token raw provider message';
    const apiErrorFetch = async () => Response.json(
      { success: false, errors: [{ code: 9109, message: privateBody }] },
      { status: 403 }
    );
    let error: unknown;
    try {
      await loadQueueOpsAnomaly({
        runtime: productionEnvironment,
        observedAt,
        fetchImplementation: apiErrorFetch as typeof fetch,
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toEqual(expect.objectContaining({
      diagnosticCode: 'ops_queue_inventory_api_error_9109',
      httpStatus: 403,
    } satisfies Partial<OpsAnomalyCollectionError>));
    expect(JSON.stringify(error)).not.toContain(privateBody);

    const invalidProviderCodeFetch = async () => Response.json(
      { success: false, errors: [{ code: null, message: privateBody }] },
      { status: 403 }
    );
    await expect(loadQueueOpsAnomaly({
      runtime: productionEnvironment,
      observedAt,
      fetchImplementation: invalidProviderCodeFetch as typeof fetch,
    })).rejects.toEqual(expect.objectContaining({
      diagnosticCode: 'ops_queue_inventory_http_403',
      httpStatus: 403,
    } satisfies Partial<OpsAnomalyCollectionError>));
  });

  test('bounds metrics HTTP and invalid response diagnostics', async () => {
    const queueRows = [
      ['media-main', 'locally-public-experience-media-mirror-production'],
      ['media-dlq', 'locally-public-experience-media-mirror-dlq-production'],
      ['translation-main', 'locally-experience-translation-production'],
      ['translation-dlq', 'locally-experience-translation-dlq-production'],
    ].map(([queue_id, queue_name]) => ({ queue_id, queue_name }));

    for (const status of [401, 403, 404, 429, 500]) {
      const fetchImplementation = async (input: RequestInfo | URL) => {
        if (String(input).endsWith('/queues?per_page=100')) {
          return Response.json({ success: true, result: queueRows });
        }
        return Response.json({ success: false, result: null, errors: [] }, { status });
      };
      await expect(loadQueueOpsAnomaly({
        runtime: productionEnvironment,
        observedAt,
        fetchImplementation: fetchImplementation as typeof fetch,
      })).rejects.toEqual(expect.objectContaining({
        diagnosticCode: `ops_queue_metrics_http_${status === 500 ? 'other' : status}`,
        httpStatus: status,
      } satisfies Partial<OpsAnomalyCollectionError>));
    }

    const invalidMetricsFetch = async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/queues?per_page=100')) {
        return Response.json({ success: true, result: queueRows });
      }
      return Response.json({ success: true, result: { backlog_count: 'not-a-number' } });
    };
    await expect(loadQueueOpsAnomaly({
      runtime: productionEnvironment,
      observedAt,
      fetchImplementation: invalidMetricsFetch as typeof fetch,
    })).rejects.toEqual(expect.objectContaining({
      diagnosticCode: 'ops_queue_metrics_invalid',
    } satisfies Partial<OpsAnomalyCollectionError>));
  });

  test('rejects invalid or incomplete Queue inventory envelopes', async () => {
    await expect(loadQueueOpsAnomaly({
      runtime: productionEnvironment,
      observedAt,
      fetchImplementation: (async () => Response.json({ success: true, result: {} })) as typeof fetch,
    })).rejects.toEqual(expect.objectContaining({
      diagnosticCode: 'ops_queue_inventory_invalid',
    } satisfies Partial<OpsAnomalyCollectionError>));

    await expect(loadQueueOpsAnomaly({
      runtime: productionEnvironment,
      observedAt,
      fetchImplementation: (async () => Response.json({
        success: true,
        result: [{ queue_id: 'media-main', queue_name: 'locally-public-experience-media-mirror-production' }],
      })) as typeof fetch,
    })).rejects.toEqual(expect.objectContaining({
      diagnosticCode: 'ops_queue_inventory_incomplete',
    } satisfies Partial<OpsAnomalyCollectionError>));
  });

  test('does not spam persistent alerts, re-alerts critical after cooldown, and resets after resolution', () => {
    const current = [anomaly('payment_reconciliation_required')];
    const first = planOpsAnomalyNotifications({
      anomalies: current,
      previousState: { activeDiagnostics: [], alertedAtByCode: {} },
      observedAt,
    });
    expect(first.alertDiagnostics).toEqual(['payment_reconciliation_required']);
    expect(first.emailDiagnostics).toEqual(['payment_reconciliation_required']);

    const repeated = planOpsAnomalyNotifications({
      anomalies: current,
      previousState: first.nextState,
      observedAt: new Date(observedAt.getTime() + 60 * 60_000),
    });
    expect(repeated.alertDiagnostics).toEqual([]);
    expect(repeated.suppressedCount).toBe(1);

    const cooldown = planOpsAnomalyNotifications({
      anomalies: current,
      previousState: first.nextState,
      observedAt: new Date(observedAt.getTime() + 24 * 60 * 60_000),
    });
    expect(cooldown.alertDiagnostics).toEqual(['payment_reconciliation_required']);

    const resolved = planOpsAnomalyNotifications({
      anomalies: [],
      previousState: first.nextState,
      observedAt,
    });
    const recurred = planOpsAnomalyNotifications({
      anomalies: current,
      previousState: resolved.nextState,
      observedAt,
    });
    expect(recurred.alertDiagnostics).toEqual(['payment_reconciliation_required']);
  });

  test('reuses the job lease and treats email failure as independent', async () => {
    const calls: string[] = [];
    const result = await runOpsAnomalyMonitor({
      supabaseAdmin: createProcessorClient({ calls }) as never,
      queueRuntime: productionEnvironment,
      emailEnv: productionEnvironment,
      triggerSource: 'cron',
      dependencies: {
        now: () => observedAt,
        collectAnomalies: async () => [anomaly('payment_state_inconsistent')],
        insertAlert: async () => ({ count: 1, targetCount: 1 }),
        sendEmail: async () => { throw new Error('private provider body'); },
      },
    });

    expect(result).toMatchObject({
      success: true,
      anomalyCount: 1,
      alertCount: 1,
      emailCount: 0,
      emailFailureCount: 1,
    });
    expect(calls).toEqual([
      'lease:abandon',
      'lease:start',
      'lease:renew',
      'state:read',
      'lease:renew',
      'lease:success',
    ]);
  });

  test('returns already_running and records query failure without leaking raw errors', async () => {
    const runningCalls: string[] = [];
    await expect(runOpsAnomalyMonitor({
      supabaseAdmin: createProcessorClient({ calls: runningCalls, alreadyRunning: true }) as never,
      queueRuntime: productionEnvironment,
      emailEnv: productionEnvironment,
      triggerSource: 'cron',
    })).resolves.toMatchObject({ success: false, outcome: 'already_running' });

    const failedCalls: string[] = [];
    const failed = await runOpsAnomalyMonitor({
      supabaseAdmin: createProcessorClient({ calls: failedCalls }) as never,
      queueRuntime: productionEnvironment,
      emailEnv: productionEnvironment,
      triggerSource: 'cron',
      dependencies: {
        collectAnomalies: async () => { throw new Error('private-order-id private-tid raw body'); },
      },
    });
    expect(failed).toMatchObject({ success: false, outcome: 'failed', error: 'Ops anomaly monitor failed.' });
    expect(JSON.stringify(failed)).not.toMatch(/private-order-id|private-tid|raw body/);
    expect(failedCalls.at(-1)).toBe('lease:failed');
  });

  test('preserves only bounded Queue failure diagnostics through the processor', async () => {
    const calls: string[] = [];
    const updates: Record<string, unknown>[] = [];
    const result = await runOpsAnomalyMonitor({
      supabaseAdmin: createProcessorClient({ calls, updates }) as never,
      queueRuntime: productionEnvironment,
      emailEnv: productionEnvironment,
      triggerSource: 'cron',
      dependencies: {
        collectAnomalies: async () => {
          throw new OpsAnomalyCollectionError('ops_queue_metrics_api_error_9109', 403);
        },
      },
    });
    expect(result).toMatchObject({
      success: false,
      diagnosticCode: 'ops_queue_metrics_api_error_9109',
      httpStatus: 403,
    });
    expect(JSON.stringify(result)).not.toMatch(/token|authorization|provider body/i);
    expect(calls.at(-1)).toBe('lease:failed');
    expect(updates.at(-1)?.details).toEqual({
      diagnostic_count: 0,
      failure_diagnostic_code: 'ops_queue_metrics_api_error_9109',
      failure_http_status: 403,
    });
    expect(JSON.stringify(updates.at(-1))).not.toMatch(/token|authorization|provider body/i);

    const unsafeUpdates: Record<string, unknown>[] = [];
    const unsafeResult = await runOpsAnomalyMonitor({
      supabaseAdmin: createProcessorClient({ calls: [], updates: unsafeUpdates }) as never,
      queueRuntime: productionEnvironment,
      emailEnv: productionEnvironment,
      triggerSource: 'cron',
      dependencies: {
        collectAnomalies: async () => {
          throw new OpsAnomalyCollectionError('private-provider-body', 999);
        },
      },
    });
    expect(unsafeResult).toMatchObject({
      success: false,
      diagnosticCode: 'ops_anomaly_monitor_failed',
    });
    expect(unsafeResult).not.toHaveProperty('httpStatus');
    expect(JSON.stringify(unsafeUpdates.at(-1))).not.toMatch(/private-provider-body|999/);
  });

  test('runs only on the exact Production trigger with the independent flag enabled', async () => {
    const calls: unknown[] = [];
    const options = {
      createClient: () => ({}) as never,
      runMonitor: async (params: unknown) => { calls.push(params); return completedResult as never; },
      log: () => undefined,
    };
    await handleOpsAnomalyMonitorScheduled({ cron: OPS_ANOMALY_MONITOR_CRON }, productionEnvironment, options);
    await handleOpsAnomalyMonitorScheduled({ cron: '1 * * * *' }, productionEnvironment, options);
    await handleOpsAnomalyMonitorScheduled(
      { cron: OPS_ANOMALY_MONITOR_CRON },
      { ...productionEnvironment, CLOUDFLARE_DEPLOYMENT_ENV: 'preview' },
      options
    );
    await handleOpsAnomalyMonitorScheduled(
      { cron: OPS_ANOMALY_MONITOR_CRON },
      { ...productionEnvironment, OPS_ANOMALY_MONITOR_SCHEDULED_ENABLED: 'false' },
      options
    );
    expect(calls).toHaveLength(1);
  });

  test('fails closed and scheduled logs stay aggregate-only', async () => {
    const logs: Record<string, unknown>[] = [];
    await expect(handleOpsAnomalyMonitorScheduled(
      { cron: OPS_ANOMALY_MONITOR_CRON }, productionEnvironment, {
        createClient: () => ({}) as never,
        runMonitor: async () => { throw new Error('private-order-id private-tid private-email private-phone'); },
        now: () => 1,
        log: (entry) => logs.push(entry),
      }
    )).rejects.toEqual(expect.objectContaining({
      diagnosticStage: 'processor',
      diagnosticCode: 'ops_anomaly_monitor_failed',
    } satisfies Partial<OpsAnomalyMonitorScheduledError>));
    expect(JSON.stringify(logs)).not.toMatch(/private-order-id|private-tid|private-email|private-phone/);
  });

  test('logs bounded Queue diagnostics without raw response or secrets', async () => {
    const logs: Record<string, unknown>[] = [];
    await expect(handleOpsAnomalyMonitorScheduled(
      { cron: OPS_ANOMALY_MONITOR_CRON }, productionEnvironment, {
        createClient: () => ({}) as never,
        runMonitor: async () => ({
          success: false,
          status: 500,
          outcome: 'failed',
          error: 'Ops anomaly monitor failed.',
          diagnosticCode: 'ops_queue_inventory_api_error_9109',
          httpStatus: 403,
        }),
        log: (entry) => logs.push(entry),
      }
    )).rejects.toEqual(expect.objectContaining({
      diagnosticCode: 'ops_queue_inventory_api_error_9109',
      httpStatus: 403,
    } satisfies Partial<OpsAnomalyMonitorScheduledError>));
    expect(logs).toEqual([expect.objectContaining({
      status: 'failed',
      diagnosticCode: 'ops_queue_inventory_api_error_9109',
      httpStatus: 403,
    })]);
    expect(JSON.stringify(logs)).not.toMatch(/private-queue-read-token|authorization|response body/i);

    logs.length = 0;
    await expect(handleOpsAnomalyMonitorScheduled(
      { cron: OPS_ANOMALY_MONITOR_CRON }, productionEnvironment, {
        createClient: () => ({}) as never,
        runMonitor: async () => ({
          success: false,
          status: 500,
          outcome: 'failed',
          error: 'Ops anomaly monitor failed.',
          diagnosticCode: 'private-provider-response',
          httpStatus: 999,
        }),
        log: (entry) => logs.push(entry),
      }
    )).rejects.toEqual(expect.objectContaining({
      diagnosticCode: 'ops_anomaly_monitor_failed',
    } satisfies Partial<OpsAnomalyMonitorScheduledError>));
    expect(JSON.stringify(logs)).not.toMatch(/private-provider-response|999/);
  });

  test('shares the admin trigger with allSettled independence and preserves the Cron set', async () => {
    const calls: string[] = [];
    const options = {
      dailyCron: '17 19 * * *',
      adminSupportCron: OPS_ANOMALY_MONITOR_CRON,
      notificationRetentionCron: '31 19 * * *',
      experienceCompletionCron: '23 */2 * * *',
      cancelPendingCron: '7,37 * * * *',
      runTranslationRecovery: () => undefined,
      runHomePopularitySnapshot: () => undefined,
      runAdminSupportUnreadAlerts: (): void => { calls.push('admin'); throw new Error('admin failed'); },
      runNotificationRetentionCleanup: () => undefined,
      runExperienceCompletionSync: () => undefined,
      runServiceCompletionSync: () => undefined,
      runCancelPendingBookings: () => undefined,
      runOpsAnomalyMonitor: (): void => { calls.push('ops'); },
      log: () => undefined,
    };
    await expect(handleLocallyScheduledEvent(
      { cron: OPS_ANOMALY_MONITOR_CRON }, {}, options
    )).rejects.toThrow('locally_scheduled_task_failed');
    expect(calls).toEqual(['admin', 'ops']);

    calls.length = 0;
    options.runAdminSupportUnreadAlerts = () => calls.push('admin');
    options.runOpsAnomalyMonitor = () => { calls.push('ops'); throw new Error('ops failed'); };
    await expect(handleLocallyScheduledEvent(
      { cron: OPS_ANOMALY_MONITOR_CRON }, {}, options
    )).rejects.toThrow('locally_scheduled_task_failed');
    expect(calls).toEqual(['admin', 'ops']);

    const wrangler = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
    const policy = JSON.parse(readFileSync(
      'config/cloudflare/ops-anomaly-monitor-release-policy.json', 'utf8'
    ));
    expect(policy.defaultProductionProfile).toBe('off');
    expect(wrangler.env.production.vars.OPS_ANOMALY_MONITOR_SCHEDULED_ENABLED).toBe('false');
    expect(new Set(wrangler.env.production.triggers.crons)).toEqual(new Set([
      '*/10 * * * *',
      '7,37 * * * *',
      '17 19 * * *',
      '23 */2 * * *',
      '31 19 * * *',
    ]));
  });
});
