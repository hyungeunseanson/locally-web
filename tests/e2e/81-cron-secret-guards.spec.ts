import { expect, test } from '@playwright/test';

import {
  BANK_TRANSFER_EXPIRED_CANCEL_REASON,
  BANK_TRANSFER_EXPIRY_MS,
  CARD_PAYMENT_HOLD_EXPIRY_MS,
  EXPLICIT_CARD_CHECKOUT_CANCEL_REASON,
  getExpiredPendingBookingCancelReason,
  getPendingBookingExpiryCutoff,
  isUnapprovedCardPaymentAttempt,
  isPendingBookingExpired,
  STALE_CARD_CHECKOUT_CANCEL_REASON,
  STALE_PAYPAL_CHECKOUT_CANCEL_REASON,
  STALE_PAYMENT_CHECKOUT_CANCEL_REASON,
} from '@/app/utils/bookings/pendingBookingHolds';
import {
  createAuthUser,
  createTestUser,
  getExpectedTestCronSecret,
  getTestAdminClient,
} from './helpers/testSupabase';
import { insertTestBooking } from './helpers/experienceBooking';

const CRON_SECRET = getExpectedTestCronSecret();

test.describe('Cron secret guards', () => {
  test('keeps payment-method-specific expiry policies and cancellation reasons', () => {
    const now = Date.UTC(2026, 6, 13, 12, 0, 0);

    expect(Date.parse(getPendingBookingExpiryCutoff('card', now))).toBe(
      now - CARD_PAYMENT_HOLD_EXPIRY_MS
    );
    expect(Date.parse(getPendingBookingExpiryCutoff('paypal', now))).toBe(
      now - CARD_PAYMENT_HOLD_EXPIRY_MS
    );
    expect(Date.parse(getPendingBookingExpiryCutoff('other', now))).toBe(
      now - CARD_PAYMENT_HOLD_EXPIRY_MS
    );
    expect(Date.parse(getPendingBookingExpiryCutoff('bank', now))).toBe(
      now - BANK_TRANSFER_EXPIRY_MS
    );
    expect(BANK_TRANSFER_EXPIRED_CANCEL_REASON).toBe(
      '입금 기한 만료 (12시간 경과 자동 취소)'
    );
    expect(STALE_CARD_CHECKOUT_CANCEL_REASON).toBe(
      '카드 결제 미완료 (2시간 경과 자동 취소)'
    );
    expect(STALE_PAYPAL_CHECKOUT_CANCEL_REASON).toBe(
      'PayPal 결제 미완료 (2시간 경과 자동 취소)'
    );
    expect(getExpiredPendingBookingCancelReason('bank')).toBe(
      BANK_TRANSFER_EXPIRED_CANCEL_REASON
    );
    expect(getExpiredPendingBookingCancelReason('card')).toBe(
      STALE_CARD_CHECKOUT_CANCEL_REASON
    );
    expect(getExpiredPendingBookingCancelReason('paypal')).toBe(
      STALE_PAYPAL_CHECKOUT_CANCEL_REASON
    );
    expect(getExpiredPendingBookingCancelReason(null)).toBe(
      STALE_PAYMENT_CHECKOUT_CANCEL_REASON
    );
  });

  test('applies strict payment-method expiry boundaries', () => {
    const now = Date.UTC(2026, 6, 13, 12, 0, 0);
    const createdAt = (ageMs: number) => new Date(now - ageMs).toISOString();

    expect(isPendingBookingExpired(
      'bank',
      createdAt(CARD_PAYMENT_HOLD_EXPIRY_MS + 60_000),
      now
    )).toBe(false);
    expect(isPendingBookingExpired(
      'bank',
      createdAt(BANK_TRANSFER_EXPIRY_MS),
      now
    )).toBe(false);
    expect(isPendingBookingExpired(
      'bank',
      createdAt(BANK_TRANSFER_EXPIRY_MS + 60_000),
      now
    )).toBe(true);
    expect(isPendingBookingExpired(
      'card',
      createdAt(CARD_PAYMENT_HOLD_EXPIRY_MS + 60_000),
      now
    )).toBe(true);
    expect(isPendingBookingExpired(
      'paypal',
      createdAt(CARD_PAYMENT_HOLD_EXPIRY_MS + 60_000),
      now
    )).toBe(true);
    expect(isPendingBookingExpired(
      'other',
      createdAt(CARD_PAYMENT_HOLD_EXPIRY_MS + 60_000),
      now
    )).toBe(true);
  });

  test('identifies only unapproved card attempts as non-bookings', () => {
    expect(isUnapprovedCardPaymentAttempt({
      status: 'PENDING',
      payment_method: 'card',
      tid: null,
      cancel_reason: null,
    })).toBe(true);
    expect(isUnapprovedCardPaymentAttempt({
      status: 'cancelled',
      payment_method: 'card',
      tid: null,
      cancel_reason: EXPLICIT_CARD_CHECKOUT_CANCEL_REASON,
    })).toBe(true);

    expect(isUnapprovedCardPaymentAttempt({
      status: 'PENDING',
      payment_method: 'bank',
      tid: null,
      cancel_reason: null,
    })).toBe(false);
    expect(isUnapprovedCardPaymentAttempt({
      status: 'PAID',
      payment_method: 'card',
      tid: 'NICEPAY-APPROVED-TID',
      cancel_reason: null,
    })).toBe(false);
    expect(isUnapprovedCardPaymentAttempt({
      status: 'cancelled',
      payment_method: 'card',
      tid: 'NICEPAY-REFUNDED-TID',
      cancel_reason: EXPLICIT_CARD_CHECKOUT_CANCEL_REASON,
    })).toBe(false);
    expect(isUnapprovedCardPaymentAttempt({
      status: 'cancelled',
      payment_method: 'card',
      tid: null,
      cancel_reason: '게스트 요청으로 승인취소 완료',
    })).toBe(false);
  });

  test('applies each payment cutoff, preserves approved cards, and is repeat-safe', async ({ request }) => {
    const supabase = getTestAdminClient();
    const user = createTestUser('cron.card.attempt.cleanup');
    const userId = await createAuthUser(user);
    const createdBookingIds: string[] = [];

    try {
      const { data: experience, error: experienceError } = await supabase
        .from('experiences')
        .select('id')
        .in('status', ['approved', 'active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (experienceError || !experience?.id) {
        throw experienceError || new Error('No public experience available for cron cleanup test.');
      }

      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + 60);
      const date = bookingDate.toISOString().slice(0, 10);
      const twoHourExpiredAt = new Date(
        Date.now() - CARD_PAYMENT_HOLD_EXPIRY_MS - 60_000
      ).toISOString();
      const bankOverTwoHoursAt = new Date(
        Date.now() - CARD_PAYMENT_HOLD_EXPIRY_MS - 60_000
      ).toISOString();
      const bankNearExpiryAt = new Date(
        Date.now() - BANK_TRANSFER_EXPIRY_MS + 60_000
      ).toISOString();
      const bankExpiredAt = new Date(
        Date.now() - BANK_TRANSFER_EXPIRY_MS - 60_000
      ).toISOString();

      const pendingCardId = await insertTestBooking({
        userId,
        experienceId: Number(experience.id),
        date,
        time: '07:00',
        guests: 1,
        status: 'PENDING',
        paymentMethod: 'card',
      });

      const releasedCardId = await insertTestBooking({
        userId,
        experienceId: Number(experience.id),
        date,
        time: '08:00',
        guests: 1,
        status: 'cancelled',
        paymentMethod: 'card',
      });

      const pendingBankOverTwoHoursId = await insertTestBooking({
        userId,
        experienceId: Number(experience.id),
        date,
        time: '09:00',
        guests: 1,
        status: 'PENDING',
        paymentMethod: 'bank',
      });

      const pendingBankNearExpiryId = await insertTestBooking({
        userId,
        experienceId: Number(experience.id),
        date,
        time: '10:00',
        guests: 1,
        status: 'PENDING',
        paymentMethod: 'bank',
      });

      const expiredBankId = await insertTestBooking({
        userId,
        experienceId: Number(experience.id),
        date,
        time: '11:00',
        guests: 1,
        status: 'PENDING',
        paymentMethod: 'bank',
      });

      const pendingPaypalId = await insertTestBooking({
        userId,
        experienceId: Number(experience.id),
        date,
        time: '12:00',
        guests: 1,
        status: 'PENDING',
        paymentMethod: 'paypal',
      });

      const approvedPaidCardId = await insertTestBooking({
        userId,
        experienceId: Number(experience.id),
        date,
        time: '13:00',
        guests: 1,
        status: 'PENDING',
        paymentMethod: 'card',
      });

      const approvedConfirmedCardId = await insertTestBooking({
        userId,
        experienceId: Number(experience.id),
        date,
        time: '14:00',
        guests: 1,
        status: 'PENDING',
        paymentMethod: 'card',
      });

      const legacyCancelledBankId = await insertTestBooking({
        userId,
        experienceId: Number(experience.id),
        date,
        time: '15:00',
        guests: 1,
        status: 'cancelled',
        paymentMethod: 'bank',
      });

      createdBookingIds.push(
        pendingCardId,
        releasedCardId,
        pendingBankOverTwoHoursId,
        pendingBankNearExpiryId,
        expiredBankId,
        pendingPaypalId,
        approvedPaidCardId,
        approvedConfirmedCardId,
        legacyCancelledBankId
      );

      const { error: fixtureUpdateError } = await supabase
        .from('bookings')
        .update({ created_at: twoHourExpiredAt })
        .in('id', [pendingCardId, releasedCardId, pendingPaypalId]);
      if (fixtureUpdateError) throw fixtureUpdateError;

      const { error: bankOverTwoHoursError } = await supabase
        .from('bookings')
        .update({ created_at: bankOverTwoHoursAt })
        .eq('id', pendingBankOverTwoHoursId);
      if (bankOverTwoHoursError) throw bankOverTwoHoursError;

      const { error: bankNearExpiryError } = await supabase
        .from('bookings')
        .update({ created_at: bankNearExpiryAt })
        .eq('id', pendingBankNearExpiryId);
      if (bankNearExpiryError) throw bankNearExpiryError;

      const { error: oldFixtureUpdateError } = await supabase
        .from('bookings')
        .update({ created_at: bankExpiredAt })
        .in('id', [expiredBankId, approvedPaidCardId, approvedConfirmedCardId, legacyCancelledBankId]);
      if (oldFixtureUpdateError) throw oldFixtureUpdateError;

      const { error: releaseReasonError } = await supabase
        .from('bookings')
        .update({ cancel_reason: EXPLICIT_CARD_CHECKOUT_CANCEL_REASON })
        .eq('id', releasedCardId);
      if (releaseReasonError) throw releaseReasonError;

      const { error: approvedPaidCardError } = await supabase
        .from('bookings')
        .update({ status: 'PAID', tid: `NICEPAY-APPROVED-${Date.now()}` })
        .eq('id', approvedPaidCardId);
      if (approvedPaidCardError) throw approvedPaidCardError;

      const { error: approvedConfirmedCardError } = await supabase
        .from('bookings')
        .update({ status: 'confirmed', tid: `NICEPAY-CONFIRMED-${Date.now()}` })
        .eq('id', approvedConfirmedCardId);
      if (approvedConfirmedCardError) throw approvedConfirmedCardError;

      const { error: legacyReasonError } = await supabase
        .from('bookings')
        .update({ cancel_reason: '입금 기한 만료 (2시간 경과 자동 취소)' })
        .eq('id', legacyCancelledBankId);
      if (legacyReasonError) throw legacyReasonError;

      const response = await request.get('/api/cron/cancel-pending', {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      });
      expect(response.status()).toBe(200);

      const { data: remainingRows, error: remainingRowsError } = await supabase
        .from('bookings')
        .select('id, status, payment_method, cancel_reason, tid')
        .in('id', createdBookingIds);
      if (remainingRowsError) throw remainingRowsError;

      expect(await response.json()).toMatchObject({
        success: true,
        count: 4,
        deletedCardAttemptCount: 2,
        cancelledBookingCount: 2,
      });

      expect(remainingRows).toHaveLength(7);
      expect(remainingRows).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: pendingBankOverTwoHoursId,
          status: 'PENDING',
          payment_method: 'bank',
          cancel_reason: null,
          tid: null,
        }),
        expect.objectContaining({
          id: pendingBankNearExpiryId,
          status: 'PENDING',
          payment_method: 'bank',
          cancel_reason: null,
          tid: null,
        }),
        expect.objectContaining({
          id: expiredBankId,
          status: 'cancelled',
          payment_method: 'bank',
          cancel_reason: BANK_TRANSFER_EXPIRED_CANCEL_REASON,
          tid: null,
        }),
        expect.objectContaining({
          id: pendingPaypalId,
          status: 'cancelled',
          payment_method: 'paypal',
          cancel_reason: STALE_PAYPAL_CHECKOUT_CANCEL_REASON,
          tid: null,
        }),
        expect.objectContaining({
          id: approvedPaidCardId,
          status: 'PAID',
          payment_method: 'card',
          tid: expect.stringContaining('NICEPAY-APPROVED-'),
        }),
        expect.objectContaining({
          id: approvedConfirmedCardId,
          status: 'confirmed',
          payment_method: 'card',
          tid: expect.stringContaining('NICEPAY-CONFIRMED-'),
        }),
        expect.objectContaining({
          id: legacyCancelledBankId,
          status: 'cancelled',
          payment_method: 'bank',
          cancel_reason: '입금 기한 만료 (2시간 경과 자동 취소)',
          tid: null,
        }),
      ]));

      const repeatResponse = await request.get('/api/cron/cancel-pending', {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      });
      expect(repeatResponse.status()).toBe(200);
      expect(await repeatResponse.json()).toMatchObject({
        message: 'No expired bookings found',
      });

      const { data: rowsAfterRepeat, error: rowsAfterRepeatError } = await supabase
        .from('bookings')
        .select('id, status, payment_method, cancel_reason, tid')
        .in('id', createdBookingIds);
      if (rowsAfterRepeatError) throw rowsAfterRepeatError;

      expect(rowsAfterRepeat).toEqual(expect.arrayContaining(remainingRows));
      expect(rowsAfterRepeat).toHaveLength(remainingRows.length);
    } finally {
      if (createdBookingIds.length > 0) {
        await supabase.from('bookings').delete().in('id', createdBookingIds);
      }
      await supabase.from('profiles').delete().eq('id', userId);
      await supabase.from('users').delete().eq('id', userId);
      await supabase.auth.admin.deleteUser(userId);
    }
  });

  test('rejects cron requests without an authorization header', async ({ request }) => {
    const responses = await Promise.all([
      request.get('/api/cron/cancel-pending'),
      request.get('/api/cron/complete-trips'),
      request.get('/api/cron/complete-services'),
      request.get('/api/cron/experience-translations'),
      request.get('/api/cron/admin-support-unread-alerts'),
      request.get('/api/cron/home-popularity-snapshot'),
      request.get('/api/cron/notification-retention-cleanup'),
      request.get('/api/bot/auto-post'),
      request.get('/api/bot/auto-comment'),
    ]);

    for (const response of responses) {
      expect(response.status()).toBe(401);
    }
  });

  test('rejects cron requests with the wrong bearer secret', async ({ request }) => {
    const responses = await Promise.all([
      request.get('/api/cron/cancel-pending', {
        headers: { authorization: 'Bearer wrong-secret' },
      }),
      request.get('/api/cron/complete-trips', {
        headers: { authorization: 'Bearer wrong-secret' },
      }),
      request.get('/api/cron/complete-services', {
        headers: { authorization: 'Bearer wrong-secret' },
      }),
      request.get('/api/cron/experience-translations', {
        headers: { authorization: 'Bearer wrong-secret' },
      }),
      request.get('/api/cron/admin-support-unread-alerts', {
        headers: { authorization: 'Bearer wrong-secret' },
      }),
      request.get('/api/cron/home-popularity-snapshot', {
        headers: { authorization: 'Bearer wrong-secret' },
      }),
      request.get('/api/cron/notification-retention-cleanup', {
        headers: { authorization: 'Bearer wrong-secret' },
      }),
      request.get('/api/bot/auto-post', {
        headers: { authorization: 'Bearer wrong-secret' },
      }),
      request.get('/api/bot/auto-comment', {
        headers: { authorization: 'Bearer wrong-secret' },
      }),
    ]);

    for (const response of responses) {
      expect(response.status()).toBe(401);
    }
  });

  test('allows the configured cron secret or local dev fallback through the guard before business logic runs', async ({ request }) => {
    const response = await request.get('/api/cron/cancel-pending', {
      headers: {
        authorization: `Bearer ${CRON_SECRET}`,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json() as Record<string, unknown>;
    expect(body.success === true || typeof body.message === 'string').toBe(true);
  });
});
