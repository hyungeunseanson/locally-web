import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { runCancelPendingBookings } from '@/app/utils/bookings/cancelPendingBookings';

const migrationPath =
  'supabase/migrations/20260922081710_experience_payment_claim_and_pending_cleanup.sql';

function source(path: string) {
  return readFileSync(path, 'utf8');
}

function createProcessorClient(calls: string[], alreadyRunning = false) {
  class Query implements PromiseLike<unknown> {
    private inserted = false;
    private updateValue: Record<string, unknown> | null = null;

    constructor(private readonly table: string) {}
    insert() { this.inserted = true; return this; }
    update(value: Record<string, unknown>) { this.updateValue = value; return this; }
    select() { return this; }
    eq() { return this; }
    lt() { return this; }
    single() { return Promise.resolve(this.resolve()); }
    maybeSingle() { return Promise.resolve(this.resolve()); }

    private resolve() {
      expect(this.table).toBe('admin_job_runs');
      if (this.inserted) {
        calls.push('lease:start');
        if (alreadyRunning) {
          return { data: null, error: { code: '23505', message: 'duplicate key' } };
        }
        return {
          data: {
            id: 7,
            started_at: '2026-09-22T00:00:00.000Z',
            lease_expires_at: '2026-09-22T00:02:00.000Z',
          },
          error: null,
        };
      }
      if (this.updateValue?.status === 'abandoned') {
        calls.push('lease:abandon');
        return { data: null, error: null };
      }
      if (this.updateValue?.status === 'success') {
        calls.push('lease:success');
        return { data: { id: 7 }, error: null };
      }
      if (this.updateValue?.status === 'failed') {
        calls.push('lease:failed');
        return { data: { id: 7 }, error: null };
      }
      if (this.updateValue?.lease_expires_at) {
        calls.push('lease:renew');
        return { data: { id: 7 }, error: null };
      }
      throw new Error('Unexpected admin_job_runs query.');
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
    rpc(name: string, args: Record<string, unknown>) {
      expect(name).toBe('cancel_expired_pending_bookings_atomic');
      expect(args).toEqual({ p_batch_size: 100 });
      calls.push('rpc:cleanup');
      return {
        maybeSingle: async () => ({
          data: {
            cancelled_count: 2,
            active_skipped_count: 1,
            reconciliation_required_count: 1,
            already_terminal_count: 0,
            has_more: false,
          },
          error: null,
        }),
      };
    },
  };
}

test.describe('Cancel pending payment-claim race safety', () => {
  test('defines the additive booking claim schema and server-only RPC boundary', () => {
    const migration = source(migrationPath);

    for (const column of [
      'payment_claim_state text',
      'payment_claim_expires_at timestamp with time zone',
      'payment_provider text',
      'payment_provider_reference text',
      'payment_claim_token uuid',
    ]) {
      expect(migration).toContain(column);
    }
    for (const state of [
      'claimed',
      'processing',
      'reconciliation_required',
      'completed',
      'released',
    ]) {
      expect(migration).toContain(`'${state}'`);
    }
    expect(migration).toContain('CREATE UNIQUE INDEX bookings_payment_provider_reference_key');
    expect(migration).toContain('CREATE INDEX bookings_pending_cleanup_candidate_idx');
    expect(migration).toContain('CREATE INDEX bookings_payment_claim_reconciliation_idx');
    expect(migration).toContain('CREATE TRIGGER bookings_payment_claim_columns_server_only');
    expect(migration).toContain('PAYMENT_CLAIM_COLUMNS_FORBIDDEN');
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.guard_experience_payment_claim_columns\(\)[\s\S]*FROM PUBLIC, anon, authenticated/
    );

    for (const rpc of [
      'claim_experience_payment_atomic',
      'attach_experience_payment_provider_reference_atomic',
      'begin_experience_payment_capture_atomic',
      'confirm_experience_payment_atomic',
      'confirm_experience_bank_payment_atomic',
      'cancel_expired_pending_bookings_atomic',
    ]) {
      expect(migration).toContain(`FUNCTION public.${rpc}`);
      expect(migration).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${rpc}\\(`));
    }
    expect(migration).toContain('FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('TO service_role');
    expect(migration).toContain("SET search_path = ''");
  });

  test('locks claims, confirmations, cleanup, and slot cleanup in the database', () => {
    const migration = source(migrationPath);

    expect(migration.match(/FOR UPDATE/g)?.length).toBeGreaterThanOrEqual(5);
    expect(migration).toContain('FOR UPDATE SKIP LOCKED');
    expect(migration).toContain("least(greatest(coalesce(p_batch_size, 100), 1), 100)");
    expect(migration).toContain("payment_claim_state = 'reconciliation_required'");
    expect(migration).toContain("payment_claim_state NOT IN ('processing', 'reconciliation_required')");
    expect(migration).toContain("created_at < now() - CASE");
    expect(migration).toContain("PERFORM pg_advisory_xact_lock(hashtext(v_slot_key)::bigint)");
    expect(migration).not.toMatch(/DELETE\s+FROM\s+public\.bookings/i);
  });

  test('gates card launch and preserves one immutable PayPal provider order', () => {
    const paymentPage = source('app/experiences/[id]/payment/page.tsx');
    const claimRoute = source('app/api/payment/card-claim/route.ts');
    const launchPage = source('app/api/payment/card-launch-page/route.ts');
    const legacyLaunch = source('app/api/payment/card-launch/route.ts');
    const paypalCreate = source('app/api/payment/paypal/create-order/route.ts');
    const paypalCapture = source('app/api/payment/paypal/capture-order/route.ts');
    const paypalServer = source('app/utils/paypal/server.ts');

    expect(paymentPage.indexOf("fetch('/api/payment/card-claim'"))
      .toBeLessThan(paymentPage.indexOf('launchCardPayment({'));
    expect(claimRoute).toContain('claimExperiencePaymentAtomic');
    expect(launchPage).toContain('resolveExperienceCardLaunch');
    expect(launchPage).toContain('launchAmount = launch.amount;');
    expect(launchPage.indexOf('resolveExperienceCardLaunch({'))
      .toBeLessThan(launchPage.indexOf('buildNicePayLaunchFields({'));
    expect(legacyLaunch).not.toContain('buildNicePayLaunchFields');
    expect(paypalCreate).toContain('claim.providerReference');
    expect(paypalCreate).toContain('claim.claimToken');
    expect(paypalCreate).toContain('attachExperiencePaymentProviderReferenceAtomic');
    expect(paypalCreate.match(/createPayPalOrder\(/g)).toHaveLength(1);
    expect(paypalServer).toContain("'PayPal-Request-Id': `create-${params.orderId}`");
    expect(paypalCapture.indexOf('beginExperiencePaymentCaptureAtomic'))
      .toBeLessThan(paypalCapture.indexOf('capturePayPalOrder(paypalOrderId)'));
    expect(paypalCapture).toContain("captureClaim.outcome === 'already_processing'");
    expect(paypalCapture).toContain('confirmExperiencePayment');
  });

  test('routes card callback, notification, PayPal, and bank through atomic confirmation', () => {
    const cardConfirmation = source('app/api/payment/experienceCardConfirmation.ts');
    const callback = source('app/api/payment/nicepay-callback/route.ts');
    const notification = source('app/api/payment/cardNotificationHandler.ts');
    const paypalCapture = source('app/api/payment/paypal/capture-order/route.ts');
    const bankConfirmation = source('app/utils/bookings/confirmExperienceBankPayment.ts');

    expect(cardConfirmation).toContain('confirmExperiencePayment({');
    expect(callback).toContain('originalBooking.payment_provider');
    expect(callback).not.toContain("return NextResponse.json({ success: true, message: 'Already processed' });\n    }\n\n    const isExplicitReleasedCardHold");
    expect(notification).toContain('finalizeExperienceCardPayment');
    expect(paypalCapture).toContain("provider: 'paypal'");
    expect(bankConfirmation).toContain('confirmExperienceBankPaymentAtomic');
    expect(bankConfirmation).not.toContain(".update({\n      status: 'confirmed'");
  });

  test('removes operational booking deletes and keeps the GitHub schedule unchanged', () => {
    const bookingRoute = source('app/api/bookings/route.ts');
    const cleanupRoute = source('app/api/cron/cancel-pending/route.ts');
    const workflow = source('.github/workflows/cancel-pending-bookings.yml');

    expect(bookingRoute).not.toContain(".from('bookings')\n            .delete()");
    expect(cleanupRoute).not.toContain('.delete()');
    expect(cleanupRoute).not.toContain('ids:');
    expect(cleanupRoute).toContain('runCancelPendingBookings');
    expect(workflow).toContain("cron: '7,37 * * * *'");
    expect(workflow).toContain('workflow_dispatch:');
  });

  test('reuses admin_job_runs lease and returns aggregate-only results', async () => {
    const calls: string[] = [];
    const result = await runCancelPendingBookings({
      supabaseAdmin: createProcessorClient(calls) as never,
      triggerSource: 'cron',
    });

    expect(result).toEqual({
      success: true,
      runId: 7,
      outcome: 'completed',
      cancelledCount: 2,
      activeSkippedCount: 1,
      reconciliationRequiredCount: 1,
      alreadyTerminalCount: 0,
      batchCount: 1,
      hasMore: false,
    });
    expect(calls).toEqual([
      'lease:abandon',
      'lease:start',
      'lease:renew',
      'rpc:cleanup',
      'lease:renew',
      'lease:success',
    ]);
    expect(JSON.stringify(result)).not.toMatch(/bookingId|orderId|providerReference|tid/i);
  });

  test('makes a competing cleanup invocation a lease no-op', async () => {
    const calls: string[] = [];
    const result = await runCancelPendingBookings({
      supabaseAdmin: createProcessorClient(calls, true) as never,
      triggerSource: 'cron',
    });

    expect(result).toMatchObject({
      success: false,
      status: 409,
      outcome: 'already_running',
    });
    expect(calls).toEqual(['lease:abandon', 'lease:start']);
  });
});
