export const BOOKING_CONFIRMED_STATUSES = ['PAID', 'confirmed', 'completed'] as const;
export const BOOKING_ACTIVE_STATUS_FOR_CAPACITY = ['PAID', 'confirmed'] as const;
export const BOOKING_PENDING_STATUSES = ['PENDING', 'pending'] as const;
export const BOOKING_CANCELLED_STATUSES = ['cancelled', 'declined', 'cancellation_requested'] as const;
export const BOOKING_BLOCKING_STATUSES_FOR_CAPACITY = [
  ...BOOKING_PENDING_STATUSES,
  ...BOOKING_ACTIVE_STATUS_FOR_CAPACITY,
] as const;

const normalizeBookingStatus = (status: string) => status.toLowerCase();

export const BOOKING_CONFIRMED_STATUSES_LOWER = BOOKING_CONFIRMED_STATUSES.map(normalizeBookingStatus);
export const BOOKING_CONFIRMED_STATUSES_UPPER = BOOKING_CONFIRMED_STATUSES.map(status => status.toUpperCase());
export const BOOKING_CANCELLED_STATUSES_LOWER = BOOKING_CANCELLED_STATUSES.map(normalizeBookingStatus);
export const BOOKING_CANCELLED_STATUSES_UPPER = BOOKING_CANCELLED_STATUSES.map(status => status.toUpperCase());

export const BOOKING_LEDGER_VISIBLE_STATUSES_UPPER = [
  'PENDING',
  ...BOOKING_CONFIRMED_STATUSES_UPPER,
  ...BOOKING_CANCELLED_STATUSES_UPPER,
];

export const isConfirmedBookingStatus = (status: string) => {
  const normalized = normalizeBookingStatus(status || '');
  return BOOKING_CONFIRMED_STATUSES_LOWER.includes(normalized);
};

export const isCancelledBookingStatus = (status: string) => {
  const normalized = normalizeBookingStatus(status || '');
  return BOOKING_CANCELLED_STATUSES_LOWER.includes(normalized);
};

export const isPendingBookingStatus = (status: string) => normalizeBookingStatus(status || '') === 'pending';

export const isCancellationRequestedBookingStatus = (status: string) =>
  normalizeBookingStatus(status || '') === 'cancellation_requested';

export const isCompletedBookingStatus = (status: string) => normalizeBookingStatus(status || '') === 'completed';

export const isCancelledOnlyBookingStatus = (status: string) => normalizeBookingStatus(status || '') === 'cancelled';
