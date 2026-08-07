import { expect, test } from '@playwright/test';

import {
  BANK_TRANSFER_EXPIRED_CANCEL_REASON,
  EXPLICIT_CARD_CHECKOUT_CANCEL_REASON,
  getExpiredPendingBookingCancelReason,
  getPendingBookingExpiryCutoff,
  isUnapprovedCardPaymentAttempt,
  PENDING_BOOKING_EXPIRY_MS,
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
  test('keeps the two-hour expiry policy while recording the correct payment reason', () => {
    const now = Date.UTC(2026, 6, 13, 12, 0, 0);

    expect(Date.parse(getPendingBookingExpiryCutoff(now))).toBe(now - PENDING_BOOKING_EXPIRY_MS);
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

  test('catches up every expired pending booking, preserves approved cards, and is repeat-safe', async ({ request }) => {
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
      const oldCreatedAt = new Date(Date.now() - PENDING_BOOKING_EXPIRY_MS - 60_000).toISOString();

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
      const pendingBankId = await insertTestBooking({
        userId,
        experienceId: Number(experience.id),
        date,
        time: '09:00',
        guests: 1,
        status: 'PENDING',
        paymentMethod: 'bank',
      });
      const approvedCardId = await insertTestBooking({
        userId,
        experienceId: Number(experience.id),
        date,
        time: '10:00',
        guests: 1,
        status: 'PENDING',
        paymentMethod: 'card',
      });
      createdBookingIds.push(pendingCardId, releasedCardId, pendingBankId, approvedCardId);

      const { error: fixtureUpdateError } = await supabase
        .from('bookings')
        .update({ created_at: oldCreatedAt })
        .in('id', createdBookingIds);
      if (fixtureUpdateError) throw fixtureUpdateError;

      const { error: releaseReasonError } = await supabase
        .from('bookings')
        .update({ cancel_reason: EXPLICIT_CARD_CHECKOUT_CANCEL_REASON })
        .eq('id', releasedCardId);
      if (releaseReasonError) throw releaseReasonError;

      const { error: approvedCardError } = await supabase
        .from('bookings')
        .update({ status: 'PAID', tid: `NICEPAY-APPROVED-${Date.now()}` })
        .eq('id', approvedCardId);
      if (approvedCardError) throw approvedCardError;

      const response = await request.get('/api/cron/cancel-pending', {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      });
      expect(response.status()).toBe(200);

      const { data: remainingRows, error: remainingRowsError } = await supabase
        .from('bookings')
        .select('id, status, payment_method, cancel_reason, tid')
        .in('id', createdBookingIds);
      if (remainingRowsError) throw remainingRowsError;

      expect(remainingRows).toHaveLength(2);
      expect(remainingRows).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: pendingBankId,
          status: 'cancelled',
          payment_method: 'bank',
          cancel_reason: BANK_TRANSFER_EXPIRED_CANCEL_REASON,
          tid: null,
        }),
        expect.objectContaining({
          id: approvedCardId,
          status: 'PAID',
          payment_method: 'card',
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
