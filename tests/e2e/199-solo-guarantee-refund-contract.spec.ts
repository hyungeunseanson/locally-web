import { expect, test } from '@playwright/test';

import {
  buildSoloRefundSettlementSnapshot,
  findSoloGuaranteeRefundCandidatesInSlot,
  getSoloManualRefundCompletionGuard,
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
    status: 'completed',
    guests: 1,
    solo_guarantee_price: 0,
    solo_guarantee_refund_status: 'not_applicable',
    solo_guarantee_refund_amount: 0,
    ...overrides,
  };
}

test.describe('Solo guarantee refund contract', () => {
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
          solo_guarantee_refund_amount: SOLO_GUARANTEE_REFUND_AMOUNT,
        }),
        booking({
          id: 'second-booking',
          status: 'completed',
        }),
      ])
    ).toEqual([]);
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
