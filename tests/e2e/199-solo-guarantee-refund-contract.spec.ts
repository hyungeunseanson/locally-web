import { expect, test } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  buildSoloRefundSettlementSnapshot,
  findSoloGuaranteeRefundCandidatesInSlot,
  getSoloGuaranteeTourEndTimestamp,
  getSoloManualRefundCompletionGuard,
  hasSoloGuaranteeTourEnded,
  SOLO_GUARANTEE_REFUND_AMOUNT,
  type SoloGuaranteeRefundSlotBooking,
} from '@/app/utils/bookings/soloGuaranteeRefundPolicy';
import { processSoloGuaranteeRefundsForCompletedBookings } from '@/app/utils/bookings/soloGuaranteeRefund';
import {
  getSoloGuaranteeRefundGuestLabel,
  isSoloGuaranteeRefundUnresolvedStatus,
} from '@/app/utils/soloGuaranteeRefundStatus';

const CUSTOM_SOLO_REFUND_AMOUNT = 40_000;

function booking(
  overrides: Partial<SoloGuaranteeRefundSlotBooking>
): SoloGuaranteeRefundSlotBooking {
  return {
    id: 'booking-default',
    date: '2026-01-01',
    time: '14:00',
    status: 'completed',
    guests: 1,
    experiences: { duration: 3 },
    solo_guarantee_price: 0,
    solo_guarantee_refund_status: 'not_applicable',
    solo_guarantee_refund_amount: 0,
    ...overrides,
  };
}

type RefundFixtureState = {
  bookings: SoloGuaranteeRefundSlotBooking[];
  notifications: Array<Record<string, unknown>>;
};

function createRefundClient(state: RefundFixtureState) {
  class Query implements PromiseLike<unknown> {
    private updateValue: Record<string, unknown> | null = null;
    private insertValue: Record<string, unknown> | Array<Record<string, unknown>> | null = null;
    private filters: Array<(row: Record<string, unknown>) => boolean> = [];
    private selected = false;
    private countRequested = false;
    private head = false;
    private rowLimit: number | null = null;
    private rowRange: { from: number; to: number } | null = null;
    private orders: Array<{ column: string; ascending: boolean }> = [];

    constructor(private readonly table: string) {}

    select(_columns?: string, options?: { count?: string; head?: boolean }) {
      this.selected = true;
      this.countRequested = options?.count === 'exact';
      this.head = options?.head === true;
      return this;
    }

    update(value: Record<string, unknown>) {
      this.updateValue = value;
      return this;
    }

    insert(value: Record<string, unknown> | Array<Record<string, unknown>>) {
      this.insertValue = value;
      return this;
    }

    eq(column: string, value: unknown) {
      this.filters.push((row) => row[column] === value);
      return this;
    }

    gt(column: string, value: number) {
      this.filters.push((row) => Number(row[column] || 0) > value);
      return this;
    }

    in(column: string, values: unknown[]) {
      this.filters.push((row) => values.includes(row[column]));
      return this;
    }

    is(column: string, value: unknown) {
      this.filters.push((row) => row[column] === value);
      return this;
    }

    order(column: string, options?: { ascending?: boolean }) {
      this.orders.push({ column, ascending: options?.ascending !== false });
      return this;
    }

    limit(value: number) {
      this.rowLimit = value;
      return this;
    }

    range(from: number, to: number) {
      this.rowRange = { from, to };
      return this;
    }

    maybeSingle() {
      return Promise.resolve(this.resolve(true));
    }

    private resolve(single = false) {
      if (this.table === 'notifications' && this.insertValue) {
        const values = Array.isArray(this.insertValue) ? this.insertValue : [this.insertValue];
        state.notifications.push(...values);
        return { data: null, error: null };
      }

      if (this.table === 'admin_whitelist') {
        return { data: [], error: null };
      }

      if (this.table !== 'bookings') {
        return { data: [], error: null };
      }

      let rows = state.bookings.filter((row) =>
        this.filters.every((filter) => filter(row as Record<string, unknown>))
      );
      const count = rows.length;
      if (this.head) {
        return { data: null, error: null, count: this.countRequested ? count : null };
      }
      rows.sort((left, right) => {
        const leftRecord = left as unknown as Record<string, unknown>;
        const rightRecord = right as unknown as Record<string, unknown>;
        for (const order of this.orders) {
          const comparison = String(leftRecord[order.column] ?? '').localeCompare(
            String(rightRecord[order.column] ?? '')
          );
          if (comparison !== 0) return order.ascending ? comparison : -comparison;
        }
        return 0;
      });
      if (this.rowLimit != null) rows = rows.slice(0, this.rowLimit);
      if (this.rowRange) rows = rows.slice(this.rowRange.from, this.rowRange.to + 1);

      if (this.updateValue) {
        rows.forEach((row) => Object.assign(row, this.updateValue));
      }

      const data = single ? rows[0] || null : rows.map((row) => ({ ...row }));
      return {
        data: this.selected || single ? data : null,
        error: null,
        count: this.countRequested ? count : null,
      };
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
  } as unknown as SupabaseClient;
}

function refundSlot(
  soloOverrides: Partial<SoloGuaranteeRefundSlotBooking> = {},
  participantOverrides: Partial<SoloGuaranteeRefundSlotBooking> = {}
) {
  const solo = booking({
    id: 'solo-booking',
    order_id: 'solo-order',
    user_id: 'solo-user',
    experience_id: 7,
    amount: 80_000,
    total_price: 80_000,
    total_experience_price: 80_000,
    price_at_booking: 50_000,
    solo_guarantee_price: SOLO_GUARANTEE_REFUND_AMOUNT,
    payout_status: 'pending',
    payment_method: 'card',
    tid: 'card-transaction',
    ...soloOverrides,
  });
  const participant = booking({
    id: 'second-booking',
    order_id: 'second-order',
    experience_id: 7,
    status: 'confirmed',
    solo_guarantee_price: 0,
    ...participantOverrides,
  });
  return { solo, participant };
}

function starvationRefundFixture() {
  const blocked = Array.from({ length: 50 }, (_, index) => booking({
    id: `old-solo-${String(index).padStart(2, '0')}`,
    order_id: `old-order-${index}`,
    experience_id: 100 + index,
    amount: 80_000,
    total_price: 80_000,
    total_experience_price: 80_000,
    price_at_booking: 50_000,
    solo_guarantee_price: SOLO_GUARANTEE_REFUND_AMOUNT,
    payout_status: 'pending',
    payment_method: 'card',
    tid: `old-card-${index}`,
  }));
  const { solo: target, participant } = refundSlot({
    id: 'zz-target-solo',
    order_id: 'zz-target-order',
    experience_id: 999,
  }, {
    id: 'zz-target-participant',
    order_id: 'zz-target-participant-order',
    experience_id: 999,
  });

  return { bookings: [...blocked, target, participant], target };
}

test.describe('Solo guarantee refund contract', () => {
  test('blocks a 14:00 three-hour experience before 17:00 and allows it at 17:00 KST', () => {
    const solo = booking({
      id: 'solo-booking',
      solo_guarantee_price: SOLO_GUARANTEE_REFUND_AMOUNT,
    });
    const second = booking({ id: 'second-booking', status: 'confirmed' });

    expect(hasSoloGuaranteeTourEnded(solo, new Date('2026-01-01T16:59:59+09:00'))).toBe(false);
    expect(findSoloGuaranteeRefundCandidatesInSlot(
      [solo, second],
      { now: new Date('2026-01-01T16:59:59+09:00') }
    )).toEqual([]);
    expect(findSoloGuaranteeRefundCandidatesInSlot(
      [solo, second],
      { now: new Date('2026-01-01T17:00:00+09:00') }
    )).toEqual([{
      bookingId: 'solo-booking',
      triggerBookingId: 'second-booking',
      refundAmount: SOLO_GUARANTEE_REFUND_AMOUNT,
    }]);
  });

  test('uses the existing two-hour experience duration fallback', () => {
    const solo = booking({ experiences: { duration: null } });
    expect(getSoloGuaranteeTourEndTimestamp(solo)).toBe(
      new Date('2026-01-01T16:00:00+09:00').getTime()
    );
  });

  test('fails closed and never calls the card PG when booking time is null', async () => {
    const { solo, participant } = refundSlot({ time: null }, { time: null });
    const state = { bookings: [solo, participant], notifications: [] };
    let pgCalls = 0;

    expect(hasSoloGuaranteeTourEnded(solo, new Date('2030-01-01T00:00:00+09:00'))).toBe(false);
    const result = await processSoloGuaranteeRefundsForCompletedBookings({
      supabaseAdmin: createRefundClient(state),
      completedBookingIds: [solo.id],
      now: new Date('2030-01-01T00:00:00+09:00'),
      cancelCardPaymentFn: async () => {
        pgCalls += 1;
        return { resultCode: '2001', resultMessage: 'ok', raw: '{}' };
      },
    });

    expect(result.refunded).toBe(0);
    expect(pgCalls).toBe(0);
    expect(solo.solo_guarantee_refund_status).toBe('not_applicable');
  });

  test('fails closed and never calls the card PG when booking time is empty', async () => {
    const { solo, participant } = refundSlot({ time: '' }, { time: '' });
    const state = { bookings: [solo, participant], notifications: [] };
    let pgCalls = 0;

    expect(hasSoloGuaranteeTourEnded(solo, new Date('2030-01-01T00:00:00+09:00'))).toBe(false);
    const result = await processSoloGuaranteeRefundsForCompletedBookings({
      supabaseAdmin: createRefundClient(state),
      completedBookingIds: [solo.id],
      now: new Date('2030-01-01T00:00:00+09:00'),
      cancelCardPaymentFn: async () => {
        pgCalls += 1;
        return { resultCode: '2001', resultMessage: 'ok', raw: '{}' };
      },
    });

    expect(result.refunded).toBe(0);
    expect(pgCalls).toBe(0);
    expect(solo.solo_guarantee_refund_status).toBe('not_applicable');
  });

  test('fails closed for malformed booking times without changing the shared time helper', () => {
    for (const time of ['25:00', '14:99', 'not-a-time']) {
      expect(getSoloGuaranteeTourEndTimestamp(booking({ time })), time).toBeNull();
    }
  });

  test('does not call the card PG before the scheduled tour end', async () => {
    const { solo, participant } = refundSlot();
    const state = { bookings: [solo, participant], notifications: [] };
    let pgCalls = 0;

    const result = await processSoloGuaranteeRefundsForCompletedBookings({
      supabaseAdmin: createRefundClient(state),
      completedBookingIds: [solo.id],
      now: new Date('2026-01-01T16:59:59+09:00'),
      cancelCardPaymentFn: async () => {
        pgCalls += 1;
        return { resultCode: '2001', resultMessage: 'ok', raw: '{}' };
      },
    });

    expect(result.refunded).toBe(0);
    expect(pgCalls).toBe(0);
    expect(solo.solo_guarantee_refund_status).toBe('not_applicable');
  });

  test('calls the card PG exactly once at the scheduled tour end', async () => {
    const { solo, participant } = refundSlot();
    const state = { bookings: [solo, participant], notifications: [] };
    let pgCalls = 0;

    const result = await processSoloGuaranteeRefundsForCompletedBookings({
      supabaseAdmin: createRefundClient(state),
      completedBookingIds: [solo.id],
      now: new Date('2026-01-01T17:00:00+09:00'),
      cancelCardPaymentFn: async () => {
        pgCalls += 1;
        return { resultCode: '2001', resultMessage: 'ok', raw: '{}' };
      },
    });

    expect(result.refunded).toBe(1);
    expect(pgCalls).toBe(1);
    expect(solo.solo_guarantee_refund_status).toBe('refunded');
    expect(solo.solo_guarantee_refund_amount).toBe(SOLO_GUARANTEE_REFUND_AMOUNT);
  });

  test('recovers an omitted completed refund in the next reconciliation run', async () => {
    const { solo, participant } = refundSlot();
    const state = { bookings: [solo, participant], notifications: [] };
    let pgCalls = 0;

    const result = await processSoloGuaranteeRefundsForCompletedBookings({
      supabaseAdmin: createRefundClient(state),
      completedBookingIds: [],
      reconcileCompleted: true,
      now: new Date('2026-01-01T17:00:00+09:00'),
      cancelCardPaymentFn: async () => {
        pgCalls += 1;
        return { resultCode: '2001', resultMessage: 'ok', raw: '{}' };
      },
    });

    expect(result.refunded).toBe(1);
    expect(pgCalls).toBe(1);
    expect(solo.solo_guarantee_refund_status).toBe('refunded');
  });

  test('rotates bounded reconciliation pages so 50 non-candidates cannot starve a later refund', async () => {
    const fixture = starvationRefundFixture();
    const state = { bookings: fixture.bookings, notifications: [] };
    const rotationMs = 2 * 60 * 60 * 1000;
    let firstRunMs = new Date('2026-01-02T00:00:00+09:00').getTime();
    while (Math.floor(firstRunMs / rotationMs) % 2 !== 0) firstRunMs += rotationMs;
    let pgCalls = 0;
    const reconcile = (now: Date) => processSoloGuaranteeRefundsForCompletedBookings({
      supabaseAdmin: createRefundClient(state),
      completedBookingIds: [],
      reconcileCompleted: true,
      now,
      cancelCardPaymentFn: async () => {
        pgCalls += 1;
        return { resultCode: '2001', resultMessage: 'ok', raw: '{}' };
      },
    });

    await reconcile(new Date(firstRunMs));
    expect(pgCalls).toBe(0);
    expect(fixture.target.solo_guarantee_refund_status).toBe('not_applicable');

    await reconcile(new Date(firstRunMs + rotationMs));
    expect(pgCalls).toBe(1);
    expect(fixture.target.solo_guarantee_refund_status).toBe('refunded');
  });

  test('directly processes a force-one target even when it is outside the current reconciliation page', async () => {
    const fixture = starvationRefundFixture();
    const state = { bookings: fixture.bookings, notifications: [] };
    let pgCalls = 0;

    const result = await processSoloGuaranteeRefundsForCompletedBookings({
      supabaseAdmin: createRefundClient(state),
      completedBookingIds: [fixture.target.id],
      now: new Date('2026-01-02T00:00:00+09:00'),
      cancelCardPaymentFn: async () => {
        pgCalls += 1;
        return { resultCode: '2001', resultMessage: 'ok', raw: '{}' };
      },
    });

    expect(result.refunded).toBe(1);
    expect(pgCalls).toBe(1);
    expect(fixture.target.solo_guarantee_refund_status).toBe('refunded');
  });

  test('never retries refunded, processing, pending_manual, or failed rows through reconciliation', async () => {
    for (const refundStatus of ['refunded', 'processing', 'pending_manual', 'failed']) {
      const { solo, participant } = refundSlot({
        solo_guarantee_refund_status: refundStatus,
        solo_guarantee_refund_amount: refundStatus === 'refunded'
          ? SOLO_GUARANTEE_REFUND_AMOUNT
          : 0,
      });
      const state = { bookings: [solo, participant], notifications: [] };
      let pgCalls = 0;

      await processSoloGuaranteeRefundsForCompletedBookings({
        supabaseAdmin: createRefundClient(state),
        completedBookingIds: [],
        reconcileCompleted: true,
        now: new Date('2026-01-01T17:00:00+09:00'),
        cancelCardPaymentFn: async () => {
          pgCalls += 1;
          return { resultCode: '2001', resultMessage: 'ok', raw: '{}' };
        },
      });

      expect(pgCalls, refundStatus).toBe(0);
      expect(solo.solo_guarantee_refund_status).toBe(refundStatus);
    }
  });

  test('keeps PayPal and bank transfer refunds pending manual', async () => {
    for (const paymentMethod of ['paypal', 'bank_transfer']) {
      const { solo, participant } = refundSlot({ payment_method: paymentMethod });
      const state = { bookings: [solo, participant], notifications: [] };
      let pgCalls = 0;

      const result = await processSoloGuaranteeRefundsForCompletedBookings({
        supabaseAdmin: createRefundClient(state),
        completedBookingIds: [solo.id],
        now: new Date('2026-01-01T17:00:00+09:00'),
        cancelCardPaymentFn: async () => {
          pgCalls += 1;
          return { resultCode: '2001', resultMessage: 'ok', raw: '{}' };
        },
      });

      expect(result.pendingManual, paymentMethod).toBe(1);
      expect(pgCalls, paymentMethod).toBe(0);
      expect(solo.solo_guarantee_refund_status).toBe('pending_manual');
    }
  });

  test('uses the status CAS so concurrent cron and force-one attempts call the card PG once', async () => {
    const { solo, participant } = refundSlot();
    const state = { bookings: [solo, participant], notifications: [] };
    const client = createRefundClient(state);
    let pgCalls = 0;
    const process = () => processSoloGuaranteeRefundsForCompletedBookings({
      supabaseAdmin: client,
      completedBookingIds: [solo.id],
      now: new Date('2026-01-01T17:00:00+09:00'),
      cancelCardPaymentFn: async () => {
        pgCalls += 1;
        return { resultCode: '2001', resultMessage: 'ok', raw: '{}' };
      },
    });

    await Promise.all([process(), process()]);

    expect(pgCalls).toBe(1);
    expect(solo.solo_guarantee_refund_status).toBe('refunded');
  });

  test('does not refund when the solo add-on booking is the only confirmed participant', () => {
    expect(
      findSoloGuaranteeRefundCandidatesInSlot([
        booking({
          id: 'solo-booking',
          solo_guarantee_price: SOLO_GUARANTEE_REFUND_AMOUNT,
        }),
      ])
    ).toEqual([]);
  });

  test('does not refund when the later participant cancelled before completion', () => {
    expect(
      findSoloGuaranteeRefundCandidatesInSlot([
        booking({
          id: 'solo-booking',
          solo_guarantee_price: SOLO_GUARANTEE_REFUND_AMOUNT,
        }),
        booking({
          id: 'cancelled-booking',
          status: 'cancelled',
        }),
      ])
    ).toEqual([]);
  });

  test('selects the solo add-on booking when another participant remains confirmed', () => {
    expect(
      findSoloGuaranteeRefundCandidatesInSlot([
        booking({
          id: 'solo-booking',
          solo_guarantee_price: SOLO_GUARANTEE_REFUND_AMOUNT,
        }),
        booking({
          id: 'second-booking',
          status: 'completed',
        }),
      ])
    ).toEqual([
      {
        bookingId: 'solo-booking',
        triggerBookingId: 'second-booking',
        refundAmount: SOLO_GUARANTEE_REFUND_AMOUNT,
      },
    ]);
  });

  test('accepts PAID, confirmed, and completed as the existing participant statuses', () => {
    for (const status of ['PAID', 'confirmed', 'completed']) {
      expect(findSoloGuaranteeRefundCandidatesInSlot([
        booking({
          id: 'solo-booking',
          solo_guarantee_price: SOLO_GUARANTEE_REFUND_AMOUNT,
        }),
        booking({ id: `second-${status}`, status }),
      ])).toHaveLength(1);
    }
  });

  test('refunds the booking snapshot add-on amount instead of a fixed default cap', () => {
    expect(
      findSoloGuaranteeRefundCandidatesInSlot([
        booking({
          id: 'custom-solo-booking',
          solo_guarantee_price: CUSTOM_SOLO_REFUND_AMOUNT,
        }),
        booking({
          id: 'second-booking',
          status: 'completed',
        }),
      ])
    ).toEqual([
      {
        bookingId: 'custom-solo-booking',
        triggerBookingId: 'second-booking',
        refundAmount: CUSTOM_SOLO_REFUND_AMOUNT,
      },
    ]);
  });

  test('does not automatically retry a failed solo refund candidate', () => {
    expect(
      findSoloGuaranteeRefundCandidatesInSlot([
        booking({
          id: 'solo-booking',
          solo_guarantee_price: SOLO_GUARANTEE_REFUND_AMOUNT,
          solo_guarantee_refund_status: 'failed',
          solo_guarantee_refund_amount: 0,
        }),
        booking({
          id: 'second-booking',
          status: 'completed',
        }),
      ])
    ).toEqual([]);
  });

  test('does not automatically process terminal or in-flight refund states', () => {
    for (const refundStatus of ['refunded', 'processing', 'pending_manual', 'failed']) {
      expect(findSoloGuaranteeRefundCandidatesInSlot([
        booking({
          id: 'solo-booking',
          solo_guarantee_price: SOLO_GUARANTEE_REFUND_AMOUNT,
          solo_guarantee_refund_status: refundStatus,
          solo_guarantee_refund_amount: 0,
        }),
        booking({ id: 'second-booking', status: 'confirmed' }),
      ])).toEqual([]);
    }
  });

  test('treats in-flight manual or failed solo refunds as payout blockers', () => {
    expect(isSoloGuaranteeRefundUnresolvedStatus('processing')).toBe(true);
    expect(isSoloGuaranteeRefundUnresolvedStatus('pending_manual')).toBe(true);
    expect(isSoloGuaranteeRefundUnresolvedStatus('failed')).toBe(true);
    expect(isSoloGuaranteeRefundUnresolvedStatus('refunded')).toBe(false);
    expect(isSoloGuaranteeRefundUnresolvedStatus('not_applicable')).toBe(false);
  });

  test('shows the refunded guest label with the booking snapshot amount', () => {
    expect(getSoloGuaranteeRefundGuestLabel('refunded', CUSTOM_SOLO_REFUND_AMOUNT)).toBe(
      '1인 진행 추가금 40,000원 환불 완료'
    );
  });

  test('deducts solo add-on from settlement when a failed refund is manually completed', () => {
    const snapshot = buildSoloRefundSettlementSnapshot(
      booking({
        id: 'failed-solo-refund',
        amount: 85000,
        total_price: 80000,
        total_experience_price: 80000,
        price_at_booking: 50000,
        solo_guarantee_price: SOLO_GUARANTEE_REFUND_AMOUNT,
        solo_guarantee_refund_status: 'failed',
        solo_guarantee_refund_amount: SOLO_GUARANTEE_REFUND_AMOUNT,
        refund_amount: 0,
        payout_status: 'pending',
      }),
      SOLO_GUARANTEE_REFUND_AMOUNT,
      { existingSoloRefundAlreadyApplied: false }
    );

    expect(snapshot).toEqual({
      total_price: 50000,
      total_experience_price: 50000,
      host_payout_amount: 40000,
      platform_revenue: 15000,
    });
  });

  test('does not double-deduct settlement when a pending manual refund is completed', () => {
    const snapshot = buildSoloRefundSettlementSnapshot(
      booking({
        id: 'pending-manual-solo-refund',
        amount: 85000,
        total_price: 50000,
        total_experience_price: 50000,
        price_at_booking: 50000,
        solo_guarantee_price: SOLO_GUARANTEE_REFUND_AMOUNT,
        solo_guarantee_refund_status: 'pending_manual',
        solo_guarantee_refund_amount: SOLO_GUARANTEE_REFUND_AMOUNT,
        refund_amount: 0,
        payout_status: 'pending',
      }),
      SOLO_GUARANTEE_REFUND_AMOUNT
    );

    expect(snapshot).toEqual({
      total_price: 50000,
      total_experience_price: 50000,
      host_payout_amount: 40000,
      platform_revenue: 15000,
    });
  });

  test('only allows manual refund completion while payout is still pending', () => {
    expect(getSoloManualRefundCompletionGuard({
      solo_guarantee_refund_status: 'pending_manual',
      payout_status: 'pending',
    })).toEqual({ ok: true });

    expect(getSoloManualRefundCompletionGuard({
      solo_guarantee_refund_status: 'failed',
      payout_status: 'paid',
    })).toEqual({ ok: false, reason: 'already_paid' });

    expect(getSoloManualRefundCompletionGuard({
      solo_guarantee_refund_status: 'pending_manual',
      payout_status: null,
    })).toEqual({ ok: false, reason: 'not_payout_pending' });
  });
});
