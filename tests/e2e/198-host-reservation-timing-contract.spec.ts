import { expect, test } from '@playwright/test';

import {
  getBookingCalendarDayDiff,
  getEffectiveCompletedStatus,
  hasBookingStarted,
  isOverdueActiveBooking,
} from '@/app/utils/bookingStartTime';

test.describe('Host reservation timing contract', () => {
  test('treats same-day future bookings as upcoming until the start time', () => {
    const now = new Date(2026, 3, 22, 10, 0, 0, 0);

    expect(hasBookingStarted('2026-04-22', '18:00', now)).toBeFalsy();
    expect(getBookingCalendarDayDiff('2026-04-22', now)).toBe(0);
    expect(isOverdueActiveBooking('confirmed', '2026-04-22', '18:00', now)).toBeFalsy();
    expect(getEffectiveCompletedStatus('confirmed', '2026-04-22', '18:00', now)).toBe('confirmed');
  });

  test('treats same-day past active bookings as completed immediately after the start time', () => {
    const now = new Date(2026, 3, 22, 18, 1, 0, 0);

    expect(hasBookingStarted('2026-04-22', '18:00', now)).toBeTruthy();
    expect(getBookingCalendarDayDiff('2026-04-22', now)).toBe(0);
    expect(isOverdueActiveBooking('PAID', '2026-04-22', '18:00', now)).toBeTruthy();
    expect(getEffectiveCompletedStatus('PAID', '2026-04-22', '18:00', now)).toBe('completed');
  });

  test('does not promote started pending bookings into completed semantics', () => {
    const now = new Date('2026-04-22T09:01:00.000Z');

    expect(hasBookingStarted('2026-04-22', '18:00', now)).toBeTruthy();
    expect(isOverdueActiveBooking('pending', '2026-04-22', '18:00', now)).toBeFalsy();
    expect(getEffectiveCompletedStatus('pending', '2026-04-22', '18:00', now)).toBe('pending');
  });

  test('interprets booking start times against KST wall-clock time consistently', () => {
    const justBeforeStart = new Date('2026-04-22T08:59:59.000Z');
    const justAfterStart = new Date('2026-04-22T09:00:01.000Z');
    const afterKstMidnight = new Date('2026-04-21T15:30:00.000Z');

    expect(hasBookingStarted('2026-04-22', '18:00', justBeforeStart)).toBeFalsy();
    expect(hasBookingStarted('2026-04-22', '18:00', justAfterStart)).toBeTruthy();
    expect(getBookingCalendarDayDiff('2026-04-22', afterKstMidnight)).toBe(0);
  });
});
