import {
  BOOKING_ACTIVE_STATUS_FOR_CAPACITY,
  BOOKING_PENDING_STATUSES,
  isCancellationRequestedBookingStatus,
  isCancelledBookingStatus,
  isCompletedBookingStatus,
} from '@/app/constants/bookingStatus';
import { hasBookingStarted } from '@/app/utils/bookingStartTime';
import { isPendingBookingExpired } from '@/app/utils/bookings/pendingBookingHolds';

const ACTIVE_STATUSES = new Set(BOOKING_ACTIVE_STATUS_FOR_CAPACITY.map((status) => status.toLowerCase()));
const PENDING_STATUSES = new Set(BOOKING_PENDING_STATUSES.map((status) => status.toLowerCase()));

export type LedgerSlotRef = {
  experience_id: number | string | null;
  date: string | null;
  time: string | null;
};

export type LedgerSlotBookingRow = LedgerSlotRef & {
  status: string | null;
  guests: number | null;
  type: string | null;
  is_solo_guarantee: boolean | null;
  solo_guarantee_refund_status: string | null;
  payment_method?: string | null;
  tid?: string | null;
  payment_claim_state?: string | null;
  created_at?: string | null;
};

export type LedgerAvailabilityRow = {
  experience_id: number | string | null;
  date: string | null;
  start_time: string | null;
  is_booked: boolean | null;
};

export type MasterLedgerSlotSummary = {
  bookingCount: number;
  confirmedBookingCount: number;
  confirmedGuestCount: number;
  pendingBookingCount: number;
  pendingGuestCount: number;
  completedBookingCount: number;
  completedGuestCount: number;
  cancelledBookingCount: number;
  cancelledGuestCount: number;
  cancellationRequestedCount: number;
  cancellationRequestedGuestCount: number;
  currentMaxGuests: number | null;
  availabilityState: 'available' | 'full' | 'private_booked' | 'private_pending' | 'not_listed' | 'experience_unavailable' | 'past' | 'unknown';
  soloGuaranteeActive: boolean;
};

function normalizeExperienceId(value: LedgerSlotRef['experience_id']) {
  const raw = String(value ?? '');
  return /^\d+$/.test(raw) && BigInt(raw) > BigInt(0) ? BigInt(raw).toString() : null;
}

function normalizeTime(value: string | null | undefined) {
  const match = String(value ?? '').match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
}

export function getMasterLedgerSlotKey(row: LedgerSlotRef) {
  const experienceId = normalizeExperienceId(row.experience_id);
  const date = String(row.date ?? '');
  const time = normalizeTime(row.time);
  if (!experienceId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !time) return null;
  return `${experienceId}|${date}|${time}`;
}

export function getMasterLedgerSlotPairs(rows: LedgerSlotRef[]) {
  const pairs = new Map<string, { experienceId: string; date: string }>();
  for (const row of rows) {
    const key = getMasterLedgerSlotKey(row);
    if (!key) continue;
    const [experienceId, date] = key.split('|');
    pairs.set(`${experienceId}|${date}`, { experienceId, date });
  }
  return [...pairs.values()];
}

function getGuestCount(value: number | null) {
  const count = Number(value);
  return Number.isInteger(count) && count > 0 ? count : 0;
}

export function buildMasterLedgerSlotSummaries({
  listedRows,
  bookingRows,
  availabilityRows,
  maxGuestsByExperience,
  experienceVisibilityById,
  now = new Date(),
}: {
  listedRows: LedgerSlotRef[];
  bookingRows: LedgerSlotBookingRow[];
  availabilityRows: LedgerAvailabilityRow[];
  maxGuestsByExperience: Map<string, number | null>;
  experienceVisibilityById?: Map<string, boolean>;
  now?: Date;
}) {
  const summaries = new Map<string, MasterLedgerSlotSummary>();
  const privateBookings = new Set<string>();
  const privatePending = new Set<string>();
  const soloCandidates = new Set<string>();
  const listedAvailability = new Set<string>();

  for (const row of listedRows) {
    const key = getMasterLedgerSlotKey(row);
    if (!key || summaries.has(key)) continue;
    const maxGuests = maxGuestsByExperience.get(key.split('|')[0]);
    summaries.set(key, {
      bookingCount: 0,
      confirmedBookingCount: 0,
      confirmedGuestCount: 0,
      pendingBookingCount: 0,
      pendingGuestCount: 0,
      completedBookingCount: 0,
      completedGuestCount: 0,
      cancelledBookingCount: 0,
      cancelledGuestCount: 0,
      cancellationRequestedCount: 0,
      cancellationRequestedGuestCount: 0,
      currentMaxGuests: maxGuests != null && Number.isInteger(maxGuests) && maxGuests > 0 ? maxGuests : null,
      availabilityState: 'unknown',
      soloGuaranteeActive: false,
    });
  }

  for (const row of bookingRows) {
    const key = getMasterLedgerSlotKey(row);
    const summary = key ? summaries.get(key) : null;
    if (!key || !summary) continue;
    const status = String(row.status ?? '').toLowerCase();
    const guests = getGuestCount(row.guests);
    if (ACTIVE_STATUSES.has(status)) {
      summary.confirmedBookingCount += 1;
      summary.confirmedGuestCount += guests;
      if (row.type === 'private') privateBookings.add(key);
      if (row.is_solo_guarantee && row.solo_guarantee_refund_status !== 'refunded') soloCandidates.add(key);
    } else if (PENDING_STATUSES.has(status)) {
      // create_booking_atomic releases stale, unapproved card attempts before its capacity check.
      if (String(row.payment_method || '').toLowerCase() === 'card' && !row.tid &&
        !row.payment_claim_state && isPendingBookingExpired('card', row.created_at, now.getTime())) continue;
      summary.pendingBookingCount += 1;
      summary.pendingGuestCount += guests;
      if (row.type === 'private') privatePending.add(key);
    } else if (isCompletedBookingStatus(status)) {
      summary.completedBookingCount += 1;
      summary.completedGuestCount += guests;
    } else if (isCancellationRequestedBookingStatus(status)) {
      summary.cancellationRequestedCount += 1;
      summary.cancellationRequestedGuestCount += guests;
    } else if (isCancelledBookingStatus(status)) {
      summary.cancelledBookingCount += 1;
      summary.cancelledGuestCount += guests;
    }
  }

  for (const row of availabilityRows) {
    if (row.is_booked !== false) continue;
    const key = getMasterLedgerSlotKey({ ...row, time: row.start_time });
    if (key && summaries.has(key)) listedAvailability.add(key);
  }

  for (const [key, summary] of summaries) {
    const [experienceId, date, time] = key.split('|');
    const heldGuests = summary.confirmedGuestCount + summary.pendingGuestCount;
    summary.bookingCount = summary.confirmedBookingCount + summary.pendingBookingCount + summary.completedBookingCount;
    summary.soloGuaranteeActive = soloCandidates.has(key) &&
      summary.confirmedBookingCount === 1 && summary.completedBookingCount === 0;
    if (hasBookingStarted(date, time, now)) {
      summary.availabilityState = 'past';
    } else if (experienceVisibilityById?.get(experienceId) === false) {
      summary.availabilityState = 'experience_unavailable';
    } else if (privateBookings.has(key)) {
      summary.availabilityState = 'private_booked';
    } else if (privatePending.has(key)) {
      summary.availabilityState = 'private_pending';
    } else if (!listedAvailability.has(key)) {
      summary.availabilityState = 'not_listed';
    } else if (summary.currentMaxGuests == null) {
      summary.availabilityState = 'unknown';
    } else {
      summary.availabilityState = heldGuests >= summary.currentMaxGuests ? 'full' : 'available';
    }
  }

  return summaries;
}
