import { expect, test } from '@playwright/test';

import {
  buildSoloRefundSettlementSnapshot,
  findSoloGuaranteeRefundCandidatesInSlot,
  getSoloGuaranteeTourEndTimestamp,
  getSoloManualRefundCompletionGuard,
  hasSoloGuaranteeTourEnded,
  SOLO_GUARANTEE_REFUND_AMOUNT,
  type SoloGuaranteeRefundSlotBooking,
} from '@/app/utils/bookings/soloGuaranteeRefundPolicy';
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

  // Financial transition and provider failures are covered by
  // tests/integration/solo-guarantee-p0.pg17.mjs against real PG17.
  test('fails closed for missing and malformed booking times', () => {
    for (const time of [null, '', 'bad', '25:00']) {
      expect(hasSoloGuaranteeTourEnded(booking({ time }), new Date('2026-01-02'))).toBe(false);
    }
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

  test('a failed or unknown card outcome never authorizes blind manual completion', () => {
    for (const status of ['failed', 'unknown', 'accepted', 'reconciliation_required', 'rejected']) {
      expect(getSoloManualRefundCompletionGuard({ solo_guarantee_refund_status: status, payout_status: 'pending' })).toEqual({ ok: false, reason: 'not_waiting' });
      expect(isSoloGuaranteeRefundUnresolvedStatus(status)).toBe(true);
    }
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
      payment_method: 'bank',
      payout_status: 'pending',
    })).toEqual({ ok: true });

    expect(getSoloManualRefundCompletionGuard({
      solo_guarantee_refund_status: 'pending_manual',
      payment_method: 'bank',
      payout_status: 'paid',
    })).toEqual({ ok: false, reason: 'already_paid' });

    expect(getSoloManualRefundCompletionGuard({
      solo_guarantee_refund_status: 'pending_manual',
      payment_method: 'bank',
      payout_status: null,
    })).toEqual({ ok: false, reason: 'not_payout_pending' });
  });
});
