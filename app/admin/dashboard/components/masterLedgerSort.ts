import type { AdminMasterLedgerEntry } from '@/app/types/admin';

export type MasterLedgerSortMode = 'payment_desc' | 'tour_asc' | 'tour_desc';

type SortableLedgerEntry = Pick<
  AdminMasterLedgerEntry,
  '_type' | 'id' | 'created_at' | 'date' | 'time'
>;

function getDateKey(value: string | null | undefined) {
  const match = value?.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return year * 10_000 + month * 100 + day;
}

function getTimeKey(value: string | null | undefined) {
  const match = value?.trim().match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  if (!match) return null;

  return Number(match[1]) * 3_600 + Number(match[2]) * 60 + Number(match[3] || 0);
}

function getCreatedAtKey(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function compareNullableNumbers(
  left: number | null,
  right: number | null,
  direction: 'asc' | 'desc'
) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  if (left === right) return 0;
  return direction === 'asc' ? left - right : right - left;
}

function compareCreatedAtDesc(left: SortableLedgerEntry, right: SortableLedgerEntry) {
  return compareNullableNumbers(
    getCreatedAtKey(left.created_at),
    getCreatedAtKey(right.created_at),
    'desc'
  );
}

export function compareMasterLedgerEntries(
  left: SortableLedgerEntry,
  right: SortableLedgerEntry,
  mode: MasterLedgerSortMode
) {
  if (mode !== 'payment_desc') {
    const direction = mode === 'tour_asc' ? 'asc' : 'desc';
    const dateComparison = compareNullableNumbers(
      getDateKey(left.date),
      getDateKey(right.date),
      direction
    );
    if (dateComparison !== 0) return dateComparison;

    const leftDateIsValid = getDateKey(left.date) !== null;
    const rightDateIsValid = getDateKey(right.date) !== null;
    if (leftDateIsValid && rightDateIsValid) {
      const timeComparison = compareNullableNumbers(
        getTimeKey(left.time),
        getTimeKey(right.time),
        direction
      );
      if (timeComparison !== 0) return timeComparison;
    }
  }

  const createdAtComparison = compareCreatedAtDesc(left, right);
  if (createdAtComparison !== 0) return createdAtComparison;

  return left.id.localeCompare(right.id);
}

export function sortMasterLedgerEntries<T extends SortableLedgerEntry>(
  entries: T[],
  mode: MasterLedgerSortMode
) {
  return [...entries].sort((left, right) => compareMasterLedgerEntries(left, right, mode));
}
