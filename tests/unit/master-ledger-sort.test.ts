import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-expect-error The Node strip-types test runner requires the explicit TypeScript extension.
import { sortMasterLedgerEntries } from '../../app/admin/dashboard/components/masterLedgerSort.ts';

function ledgerEntry({
  id,
  createdAt,
  date,
  time,
  type = 'experience',
}: {
  id: string;
  createdAt: string;
  date: string;
  time: string | null;
  type?: 'experience' | 'service';
}) {
  return {
    _type: type,
    id,
    created_at: createdAt,
    date,
    time,
  };
}

const mixedEntries = [
  ledgerEntry({
    id: 'experience-later-tour',
    createdAt: '2030-01-04T00:00:00.000Z',
    date: '2030-02-20',
    time: '10:00',
  }),
  ledgerEntry({
    id: 'service-earliest-tour',
    createdAt: '2030-01-01T00:00:00.000Z',
    date: '2030-02-10',
    time: '09:00:00',
    type: 'service',
  }),
  ledgerEntry({
    id: 'experience-later-time',
    createdAt: '2030-01-03T00:00:00.000Z',
    date: '2030-02-10',
    time: '15:00',
  }),
  ledgerEntry({
    id: 'malformed-tour-date',
    createdAt: '2030-01-02T00:00:00.000Z',
    date: '2030-02-31',
    time: '12:00',
  }),
];

test('keeps payment newest-first as the default ledger order without mutating input', () => {
  const originalIds = mixedEntries.map((entry) => entry.id);
  const sorted = sortMasterLedgerEntries(mixedEntries, 'payment_desc');

  assert.deepEqual(sorted.map((entry) => entry.id), [
    'experience-later-tour',
    'experience-later-time',
    'malformed-tour-date',
    'service-earliest-tour',
  ]);
  assert.deepEqual(mixedEntries.map((entry) => entry.id), originalIds);
});

test('sorts mixed experience and service rows by tour date and time in both directions', () => {
  assert.deepEqual(
    sortMasterLedgerEntries(mixedEntries, 'tour_asc').map((entry) => entry.id),
    [
      'service-earliest-tour',
      'experience-later-time',
      'experience-later-tour',
      'malformed-tour-date',
    ]
  );
  assert.deepEqual(
    sortMasterLedgerEntries(mixedEntries, 'tour_desc').map((entry) => entry.id),
    [
      'experience-later-tour',
      'experience-later-time',
      'service-earliest-tour',
      'malformed-tour-date',
    ]
  );
});

test('uses payment newest-first and then booking ID for identical tour timestamps', () => {
  const entries = [
    ledgerEntry({
      id: 'booking-c',
      createdAt: '2030-01-01T00:00:00.000Z',
      date: '2030-02-10',
      time: '10:00',
    }),
    ledgerEntry({
      id: 'booking-b',
      createdAt: '2030-01-02T00:00:00.000Z',
      date: '2030-02-10',
      time: '10:00:00',
    }),
    ledgerEntry({
      id: 'booking-a',
      createdAt: '2030-01-02T00:00:00.000Z',
      date: '2030-02-10',
      time: '10:00',
    }),
  ];

  assert.deepEqual(
    sortMasterLedgerEntries(entries, 'tour_asc').map((entry) => entry.id),
    ['booking-a', 'booking-b', 'booking-c']
  );
});

test('places missing or malformed dates last regardless of tour sort direction', () => {
  const entries = [
    ledgerEntry({
      id: 'missing-date',
      createdAt: '2030-01-04T00:00:00.000Z',
      date: '',
      time: '09:00',
    }),
    ledgerEntry({
      id: 'malformed-date',
      createdAt: '2030-01-03T00:00:00.000Z',
      date: 'not-a-date',
      time: '09:00',
    }),
    ledgerEntry({
      id: 'valid-date',
      createdAt: '2030-01-01T00:00:00.000Z',
      date: '2030-02-10',
      time: null,
    }),
  ];

  for (const mode of ['tour_asc', 'tour_desc'] as const) {
    assert.deepEqual(
      sortMasterLedgerEntries(entries, mode).map((entry) => entry.id),
      ['valid-date', 'missing-date', 'malformed-date']
    );
  }
});
