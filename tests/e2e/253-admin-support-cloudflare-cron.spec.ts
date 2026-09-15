import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { processDueAdminSupportUnreadAlerts } from '../../app/utils/adminSupportUnreadAlerts';
import { executeAdminSupportUnreadAlertsCron } from '../../app/api/cron/admin-support-unread-alerts/route';
import {
  ADMIN_SUPPORT_UNREAD_ALERTS_CRON,
  handleAdminSupportUnreadAlertsScheduled,
} from '../../app/utils/adminSupportUnreadAlertsScheduled';
import { handleLocallyScheduledEvent } from '../../app/utils/cloudflareScheduled';
import { HOME_POPULARITY_SNAPSHOT_CRON } from '../../app/utils/homePopularitySnapshot';

type Batch = {
  inquiry_id: number;
  is_active: boolean;
  first_unread_message_id: number;
  first_unread_message_at: string;
  last_unread_message_id: number;
  last_unread_message_at: string;
  alert_due_at: string;
  in_app_sent_at: string | null;
  email_sent_at: string | null;
  processing_started_at: string | null;
};

function createProcessorFixture(options: {
  batch?: Partial<Batch>;
  claimDelayMs?: number;
  supersedeBeforeRelease?: boolean;
} = {}) {
  const batch: Batch = {
    inquiry_id: 7,
    is_active: true,
    first_unread_message_id: 70,
    first_unread_message_at: '2026-09-15T08:00:00.000Z',
    last_unread_message_id: 71,
    last_unread_message_at: '2026-09-15T08:10:00.000Z',
    alert_due_at: '2026-09-15T09:00:00.000Z',
    in_app_sent_at: null,
    email_sent_at: null,
    processing_started_at: null,
    ...options.batch,
  };
  let claimed = false;
  const writes: Array<Record<string, unknown>> = [];

  class Query implements PromiseLike<unknown> {
    private filters: Array<[string, unknown]> = [];
    private patch: Record<string, unknown> | null = null;
    private selection = '';
    private selectOptions: Record<string, unknown> | undefined;

    constructor(private readonly table: string) {}
    select(columns: string, selectOptions?: Record<string, unknown>) {
      this.selection = columns;
      this.selectOptions = selectOptions;
      return this;
    }
    update(patch: Record<string, unknown>) {
      this.patch = patch;
      return this;
    }
    eq(column: string, value: unknown) {
      this.filters.push([column, value]);
      return this;
    }
    is(column: string, value: unknown) {
      this.filters.push([column, value]);
      return this;
    }
    in() { return this; }
    order() { return this; }
    limit() { return this; }
    not() { return this; }
    lte() { return this; }
    maybeSingle() { return this; }

    private resolve() {
      if (this.patch) {
        writes.push({ ...this.patch });
        Object.assign(batch, this.patch);
        const firstIdentity = this.filters.find(([column]) => column === 'first_unread_message_id');
        const updated = !options.supersedeBeforeRelease &&
          (!firstIdentity || String(firstIdentity[1]) === String(batch.first_unread_message_id));
        return { data: updated ? [{ inquiry_id: batch.inquiry_id }] : [], error: null };
      }
      if (this.table === 'inquiries') {
        return { data: [{ id: batch.inquiry_id, user_id: 'guest-fixture', type: 'admin_support' }], error: null };
      }
      if (this.table === 'profiles') {
        return { data: [{ id: 'guest-fixture', full_name: 'private guest', email: 'private@example.test' }], error: null };
      }
      if (this.table === 'inquiry_messages' && this.selectOptions?.head === true) {
        return { data: null, count: 1, error: null };
      }
      if (this.table === 'inquiry_messages' && this.selection.includes('content')) {
        return { data: [{ id: batch.last_unread_message_id, content: 'private unread text', type: 'text' }], error: null };
      }
      throw new Error(`unexpected fixture query: ${this.table}:${this.selection}`);
    }

    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): PromiseLike<TResult1 | TResult2> {
      return Promise.resolve().then(() => this.resolve()).then(onfulfilled, onrejected);
    }
  }

  const client = {
    async rpc(name: string) {
      expect(name).toBe('claim_due_admin_support_unread_alert_batches');
      if (claimed) return { data: [], error: null };
      claimed = true;
      batch.processing_started_at = new Date().toISOString();
      if (options.claimDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.claimDelayMs));
      }
      return { data: [{ ...batch }], error: null };
    },
    from(table: string) {
      return new Query(table);
    },
  };

  return { batch, client, writes };
}

const runtimeEnvironment = {
  CLOUDFLARE_DEPLOYMENT_ENV: 'production',
  ADMIN_SUPPORT_UNREAD_ALERTS_SCHEDULED_ENABLED: 'true',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329',
  SUPABASE_SERVICE_ROLE_KEY: 'fixture-service-role',
  ADMIN_GMAIL_USER: 'private-admin@example.test',
  ADMIN_GMAIL_APP_PASSWORD: 'fixture-gmail-secret',
};

test.describe('Admin Support unread Cloudflare Cron', () => {
  test('HTTP fallback retains its CRON_SECRET guard and response contract', async () => {
    const unauthorized = await executeAdminSupportUnreadAlertsCron(
      new Request('https://example.test/api/cron/admin-support-unread-alerts'),
      async () => ({ success: true, claimedCount: 0, alertedCount: 0, emailedCount: 0, skippedCount: 0 })
    );
    expect(unauthorized.status).toBe(401);

    const response = await executeAdminSupportUnreadAlertsCron(
      new Request('https://example.test/api/cron/admin-support-unread-alerts', {
        headers: { authorization: 'Bearer local-admin-support-cron-secret' },
      }),
      async () => ({ success: true, claimedCount: 0, alertedCount: 0, emailedCount: 0, skippedCount: 0 })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      claimedCount: 0,
      alertedCount: 0,
      emailedCount: 0,
      skippedCount: 0,
    });
  });

  test('preserves channel markers for full success, partial failure, and already-sent rows', async () => {
    const success = createProcessorFixture();
    const successResult = await processDueAdminSupportUnreadAlerts({
      supabaseAdmin: success.client as never,
      insertAdminAlerts: async () => ({ success: true, count: 2, targetCount: 2 }),
      sendAdminAlertEmails: async () => ({ success: true, count: 2, targetCount: 2 }),
      log: () => undefined,
    });
    expect(successResult).toMatchObject({ claimedCount: 1, alertedCount: 2, emailedCount: 2, failureCount: 0 });
    expect(success.batch.in_app_sent_at).toBeTruthy();
    expect(success.batch.email_sent_at).toBeTruthy();
    expect(success.batch.processing_started_at).toBeNull();

    const partial = createProcessorFixture();
    const partialResult = await processDueAdminSupportUnreadAlerts({
      supabaseAdmin: partial.client as never,
      insertAdminAlerts: async () => ({ success: true, count: 1, targetCount: 1 }),
      sendAdminAlertEmails: async () => { throw new Error('private provider response'); },
      log: () => undefined,
    });
    expect(partialResult).toMatchObject({ claimedCount: 1, alertedCount: 1, emailedCount: 0, failureCount: 1 });
    expect(partial.batch.in_app_sent_at).toBeTruthy();
    expect(partial.batch.email_sent_at).toBeNull();
    expect(partial.batch.processing_started_at).toBeNull();

    const inAppFailure = createProcessorFixture();
    let emailsAfterInAppFailure = 0;
    const inAppFailureResult = await processDueAdminSupportUnreadAlerts({
      supabaseAdmin: inAppFailure.client as never,
      insertAdminAlerts: async () => { throw new Error('private database body'); },
      sendAdminAlertEmails: async () => {
        emailsAfterInAppFailure += 1;
        return { success: true, count: 1, targetCount: 1 };
      },
      log: () => undefined,
    });
    expect(inAppFailureResult).toMatchObject({ failureCount: 1 });
    expect(inAppFailure.batch.in_app_sent_at).toBeNull();
    expect(inAppFailure.batch.email_sent_at).toBeNull();
    expect(inAppFailure.batch.processing_started_at).toBeNull();
    expect(emailsAfterInAppFailure).toBe(0);

    const partialTarget = createProcessorFixture();
    await processDueAdminSupportUnreadAlerts({
      supabaseAdmin: partialTarget.client as never,
      insertAdminAlerts: async () => ({ success: true, count: 1, targetCount: 2 }),
      sendAdminAlertEmails: async () => ({ success: true, count: 1, targetCount: 2 }),
    });
    expect(partialTarget.batch.in_app_sent_at).toBeNull();
    expect(partialTarget.batch.email_sent_at).toBeNull();

    const alreadySent = createProcessorFixture({
      batch: {
        in_app_sent_at: '2026-09-15T09:01:00.000Z',
        email_sent_at: '2026-09-15T09:02:00.000Z',
      },
    });
    let deliveryCalls = 0;
    await processDueAdminSupportUnreadAlerts({
      supabaseAdmin: alreadySent.client as never,
      insertAdminAlerts: async () => { deliveryCalls += 1; return { success: true, count: 1, targetCount: 1 }; },
      sendAdminAlertEmails: async () => { deliveryCalls += 1; return { success: true, count: 1, targetCount: 1 }; },
    });
    expect(deliveryCalls).toBe(0);
  });

  test('a target count of zero marks channels complete without a delivery', async () => {
    const fixture = createProcessorFixture();
    const result = await processDueAdminSupportUnreadAlerts({
      supabaseAdmin: fixture.client as never,
      insertAdminAlerts: async () => ({ success: true, count: 0, targetCount: 0 }),
      sendAdminAlertEmails: async () => ({ success: true, count: 0, targetCount: 0 }),
    });
    expect(result).toMatchObject({ alertedCount: 0, emailedCount: 0, failureCount: 0 });
    expect(fixture.batch.in_app_sent_at).toBeTruthy();
    expect(fixture.batch.email_sent_at).toBeTruthy();
  });

  test('atomic claims prevent duplicate delivery and wave supersession blocks old release', async () => {
    const fixture = createProcessorFixture({ claimDelayMs: 20 });
    let alerts = 0;
    const run = () => processDueAdminSupportUnreadAlerts({
      supabaseAdmin: fixture.client as never,
      insertAdminAlerts: async () => { alerts += 1; return { success: true, count: 1, targetCount: 1 }; },
      sendAdminAlertEmails: async () => ({ success: true, count: 1, targetCount: 1 }),
    });
    const results = await Promise.all([run(), run()]);
    expect(results.map((result) => result.claimedCount).sort()).toEqual([0, 1]);
    expect(alerts).toBe(1);

    const logs: Record<string, unknown>[] = [];
    const superseded = createProcessorFixture({ supersedeBeforeRelease: true });
    await processDueAdminSupportUnreadAlerts({
      supabaseAdmin: superseded.client as never,
      insertAdminAlerts: async () => ({ success: true, count: 1, targetCount: 1 }),
      sendAdminAlertEmails: async () => ({ success: true, count: 1, targetCount: 1 }),
      log: (entry) => logs.push(entry),
    });
    expect(logs).toContainEqual(expect.objectContaining({ diagnosticCode: 'wave_superseded' }));
    expect(JSON.stringify(logs)).not.toContain('private');
  });

  test('the repository RPC contract retains skip-locked and 15-minute stale reclaim semantics', () => {
    const source = readFileSync('supabase/migrations/20260912034545_production_schema_baseline.sql', 'utf8');
    const start = source.indexOf('CREATE OR REPLACE FUNCTION public.claim_due_admin_support_unread_alert_batches');
    const end = source.indexOf('$function$;', start);
    expect(start).toBeGreaterThanOrEqual(0);
    const definition = source.slice(start, end);
    expect(definition).toContain('SECURITY DEFINER');
    expect(definition).toContain("SET search_path TO 'public'");
    expect(definition).toContain("now() - interval '15 minutes'");
    expect(definition).toContain('ORDER BY batch.alert_due_at ASC, batch.inquiry_id ASC');
    expect(definition).toContain('FOR UPDATE SKIP LOCKED');
  });

  test('scheduled runtime is exact-cron, Production-only, default-off, and sanitized', async () => {
    const calls: Record<string, unknown>[] = [];
    const process = async () => {
      calls.push({ process: true });
      return { success: true, claimedCount: 0, alertedCount: 0, emailedCount: 0, skippedCount: 0, failureCount: 0 } as const;
    };
    await expect(handleAdminSupportUnreadAlertsScheduled(
      { cron: ADMIN_SUPPORT_UNREAD_ALERTS_CRON },
      runtimeEnvironment,
      { process: process as never, createInvocationId: () => 'invocation-fixture', log: (entry) => calls.push(entry) }
    )).resolves.toMatchObject({ status: 'completed', claimedCount: 0 });
    await handleAdminSupportUnreadAlertsScheduled(
      { cron: HOME_POPULARITY_SNAPSHOT_CRON },
      runtimeEnvironment,
      { process: process as never }
    );
    await handleAdminSupportUnreadAlertsScheduled(
      { cron: ADMIN_SUPPORT_UNREAD_ALERTS_CRON },
      { ...runtimeEnvironment, CLOUDFLARE_DEPLOYMENT_ENV: 'canary' },
      { process: process as never }
    );
    await handleAdminSupportUnreadAlertsScheduled(
      { cron: ADMIN_SUPPORT_UNREAD_ALERTS_CRON },
      { ...runtimeEnvironment, ADMIN_SUPPORT_UNREAD_ALERTS_SCHEDULED_ENABLED: 'false' },
      { process: process as never }
    );
    expect(calls.filter((entry) => entry.process)).toHaveLength(1);
    const serialized = JSON.stringify(calls);
    expect(serialized).not.toContain('fixture-service-role');
    expect(serialized).not.toContain('fixture-gmail-secret');
    expect(serialized).not.toContain('private-admin');
  });

  test('scheduled multiplexer isolates daily tasks from the ten-minute task', async () => {
    const calls: string[] = [];
    const options = {
      dailyCron: HOME_POPULARITY_SNAPSHOT_CRON,
      adminSupportCron: ADMIN_SUPPORT_UNREAD_ALERTS_CRON,
      notificationRetentionCron: '31 19 * * *',
      runTranslationRecovery: () => calls.push('translation'),
      runHomePopularitySnapshot: () => calls.push('home'),
      runAdminSupportUnreadAlerts: () => calls.push('admin-support'),
      runNotificationRetentionCleanup: () => calls.push('retention'),
      log: () => undefined,
    };
    await handleLocallyScheduledEvent({ cron: ADMIN_SUPPORT_UNREAD_ALERTS_CRON }, {}, options);
    expect(calls).toEqual(['admin-support']);
    calls.length = 0;
    await handleLocallyScheduledEvent({ cron: HOME_POPULARITY_SNAPSHOT_CRON }, {}, options);
    expect(calls).toEqual(['translation', 'home']);
  });

  test('retires only the GitHub automatic schedule and keeps the authenticated manual fallback', () => {
    const workflow = readFileSync('.github/workflows/admin-support-unread-alerts.yml', 'utf8');
    expect(workflow).not.toMatch(/\n\s*schedule:\s*(?:\n|$)/);
    expect(workflow).toMatch(/\n\s*workflow_dispatch:\s*(?:\n|$)/);
    expect(workflow).toContain('group: admin-support-unread-alerts');
    expect(workflow).toContain('${PROD_URL%/}/api/cron/admin-support-unread-alerts');
    expect(workflow).toContain('-H "Authorization: Bearer ${CRON_SECRET}"');
  });
});
