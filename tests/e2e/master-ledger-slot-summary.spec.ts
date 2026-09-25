import { expect, test } from '@playwright/test';
import {
  buildMasterLedgerSlotSummaries,
  getMasterLedgerSlotKey,
  getMasterLedgerSlotPairs,
  type LedgerSlotBookingRow,
} from '../../app/utils/masterLedgerSlotSummary';

const slot = (overrides: Partial<LedgerSlotBookingRow> = {}): LedgerSlotBookingRow => ({
  experience_id: 4659,
  date: '2030-09-30',
  time: '12:00:00',
  guests: 1,
  status: 'confirmed',
  type: 'group',
  is_solo_guarantee: false,
  solo_guarantee_refund_status: 'not_applicable',
  ...overrides,
});

test('uses experience, date, and normalized time to separate sessions', () => {
  expect(getMasterLedgerSlotKey(slot())).toBe('4659|2030-09-30|12:00');
  expect(getMasterLedgerSlotKey(slot({ time: '12:30' }))).toBe('4659|2030-09-30|12:30');
  expect(getMasterLedgerSlotKey(slot({ time: null }))).toBeNull();
  expect(getMasterLedgerSlotPairs([slot(), slot({ time: '12:30' }), slot({ experience_id: 4660 })])).toEqual([
    { experienceId: '4659', date: '2030-09-30' },
    { experienceId: '4660', date: '2030-09-30' },
  ]);
});

test('separates confirmed, temporary holds, cancellation, and another time', () => {
  const listed = [slot(), slot({ time: '12:30' })];
  const summaries = buildMasterLedgerSlotSummaries({
    listedRows: listed,
    bookingRows: [
      slot(),
      slot({ guests: 2, status: 'PAID' }),
      slot({ guests: 1, status: 'PENDING' }),
      slot({ guests: 4, status: 'cancelled' }),
      slot({ guests: 2, status: 'cancellation_requested' }),
      slot({ guests: 2, time: '12:30' }),
    ],
    availabilityRows: [
      { experience_id: 4659, date: '2030-09-30', start_time: '12:00', is_booked: false },
      { experience_id: 4659, date: '2030-09-30', start_time: '12:30', is_booked: false },
    ],
    maxGuestsByExperience: new Map([['4659', 4]]),
    now: new Date('2030-09-01T00:00:00Z'),
  });
  const noon = summaries.get('4659|2030-09-30|12:00');
  const later = summaries.get('4659|2030-09-30|12:30');
  expect(noon).toMatchObject({
    bookingCount: 3, confirmedBookingCount: 2, confirmedGuestCount: 3,
    pendingBookingCount: 1, pendingGuestCount: 1,
    cancelledBookingCount: 1, cancelledGuestCount: 4,
    cancellationRequestedCount: 1, cancellationRequestedGuestCount: 2,
    currentMaxGuests: 4, availabilityState: 'full',
  });
  expect(later).toMatchObject({ bookingCount: 1, confirmedGuestCount: 2, availabilityState: 'available' });
});

test('retains completed attendance without treating it as current held capacity', () => {
  const summaries = buildMasterLedgerSlotSummaries({
    listedRows: [slot({ date: '2026-09-22', status: 'completed' })],
    bookingRows: [
      slot({ date: '2026-09-22', status: 'completed', guests: 2 }),
      slot({ date: '2026-09-22', status: 'completed', guests: 1 }),
    ],
    availabilityRows: [],
    maxGuestsByExperience: new Map([['4659', 4]]),
    now: new Date('2026-09-25T00:00:00Z'),
  });
  expect(summaries.get('4659|2026-09-22|12:00')).toMatchObject({
    bookingCount: 2, confirmedGuestCount: 0, completedBookingCount: 2,
    completedGuestCount: 3, availabilityState: 'past',
  });
});

test('private booking blocks capacity while solo guarantee alone does not', () => {
  const listed = [slot(), slot({ time: '13:00' })];
  const summaries = buildMasterLedgerSlotSummaries({
    listedRows: listed,
    bookingRows: [
      slot({ type: 'private' }),
      slot({ time: '13:00', is_solo_guarantee: true }),
      slot({ time: '13:00', status: 'PENDING' }),
    ],
    availabilityRows: [
      { experience_id: 4659, date: '2030-09-30', start_time: '12:00', is_booked: false },
      { experience_id: 4659, date: '2030-09-30', start_time: '13:00', is_booked: false },
    ],
    maxGuestsByExperience: new Map([['4659', 4]]),
    now: new Date('2030-09-01T00:00:00Z'),
  });
  expect(summaries.get('4659|2030-09-30|12:00')).toMatchObject({ availabilityState: 'private_booked' });
  expect(summaries.get('4659|2030-09-30|13:00')).toMatchObject({
    availabilityState: 'available', pendingGuestCount: 1, soloGuaranteeActive: true,
  });
});

test('does not invent a historical capacity when the current setting is missing', () => {
  const summaries = buildMasterLedgerSlotSummaries({
    listedRows: [slot()],
    bookingRows: [slot()],
    availabilityRows: [{ experience_id: 4659, date: '2030-09-30', start_time: '12:00', is_booked: false }],
    maxGuestsByExperience: new Map(),
    now: new Date('2030-09-01T00:00:00Z'),
  });
  expect(summaries.get('4659|2030-09-30|12:00')).toMatchObject({
    currentMaxGuests: null, availabilityState: 'unknown',
  });
});

test('excludes the stale unapproved card attempt that the booking RPC releases', () => {
  const summaries = buildMasterLedgerSlotSummaries({
    listedRows: [slot()],
    bookingRows: [
      slot(),
      slot({ status: 'PENDING', payment_method: 'card', tid: null,
        payment_claim_state: null, created_at: '2030-09-01T00:00:00Z' }),
      slot({ status: 'PENDING', payment_method: 'bank', created_at: '2030-09-01T00:00:00Z' }),
    ],
    availabilityRows: [{ experience_id: 4659, date: '2030-09-30', start_time: '12:00', is_booked: false }],
    maxGuestsByExperience: new Map([['4659', 4]]),
    now: new Date('2030-09-01T01:00:00Z'),
  });
  expect(summaries.get('4659|2030-09-30|12:00')).toMatchObject({
    bookingCount: 2, confirmedGuestCount: 1, pendingGuestCount: 1, availabilityState: 'available',
  });
});

test('does not call a hidden experience publicly bookable', () => {
  const summaries = buildMasterLedgerSlotSummaries({
    listedRows: [slot()], bookingRows: [slot()],
    availabilityRows: [{ experience_id: 4659, date: '2030-09-30', start_time: '12:00', is_booked: false }],
    maxGuestsByExperience: new Map([['4659', 4]]),
    experienceVisibilityById: new Map([['4659', false]]),
    now: new Date('2030-09-01T00:00:00Z'),
  });
  expect(summaries.get('4659|2030-09-30|12:00')?.availabilityState).toBe('experience_unavailable');
});
