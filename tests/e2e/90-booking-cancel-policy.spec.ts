import { expect, test } from '@playwright/test';

import { calculateGuestCancellationRefundRate } from '@/app/utils/bookingCancellationPolicy';

test.describe('Booking cancellation policy helper', () => {
  test('applies same-day payment cancellation before general refund windows', () => {
    const cases = [
      {
        input: {
          tourDate: '2026-03-24',
          tourTime: '18:00',
          paymentDate: '2026-03-23T09:00:00+09:00',
          now: new Date('2026-03-23T20:00:00+09:00'),
        },
        expected: { rate: 100, reason: '결제 당일 취소' },
      },
      {
        input: {
          tourDate: '2026-03-24',
          tourTime: '18:00',
          paymentDate: '2026-03-16T09:00:00+09:00',
          now: new Date('2026-03-23T20:00:00+09:00'),
        },
        expected: { rate: 40, reason: '1일 전 취소' },
      },
      {
        input: {
          tourDate: '2026-03-26',
          tourTime: '18:00',
          paymentDate: '2026-03-22T09:00:00+09:00',
          now: new Date('2026-03-23T20:00:00+09:00'),
        },
        expected: { rate: 70, reason: '2~7일 전 취소' },
      },
      {
        input: {
          tourDate: '2026-04-02',
          tourTime: '18:00',
          paymentDate: '2026-03-23T09:00:00+09:00',
          now: new Date('2026-03-23T20:00:00+09:00'),
        },
        expected: { rate: 100, reason: '결제 당일 취소' },
      },
      {
        input: {
          tourDate: '2026-04-02',
          tourTime: '18:00',
          paymentDate: '2026-03-22T09:00:00+09:00',
          now: new Date('2026-03-23T20:00:00+09:00'),
        },
        expected: { rate: 80, reason: '8~19일 전 취소' },
      },
      {
        input: {
          tourDate: '2026-04-12',
          tourTime: '18:00',
          paymentDate: '2026-03-22T09:00:00+09:00',
          now: new Date('2026-03-23T20:00:00+09:00'),
        },
        expected: { rate: 100, reason: '20일 전 취소' },
      },
      {
        input: {
          tourDate: '2026-03-23',
          tourTime: '22:00',
          paymentDate: '2026-03-23T09:00:00+09:00',
          now: new Date('2026-03-23T20:00:00+09:00'),
        },
        expected: { rate: 0, reason: '당일/지난 일정' },
      },
    ] as const;

    for (const testCase of cases) {
      expect(calculateGuestCancellationRefundRate(testCase.input)).toEqual(testCase.expected);
    }
  });
});
