export const BOOKING_CONFIRMED_STATUSES = ['PAID', 'confirmed', 'completed'] as const;
export const BOOKING_ACTIVE_STATUS_FOR_CAPACITY = ['PAID', 'confirmed'] as const;
export const BOOKING_CANCELLED_STATUSES = ['cancelled', 'declined', 'cancellation_requested'] as const;

export const isConfirmedBookingStatus = (status: string) =>
  BOOKING_CONFIRMED_STATUSES.includes(status as (typeof BOOKING_CONFIRMED_STATUSES)[number]);

export const isCancelledBookingStatus = (status: string) =>
  BOOKING_CANCELLED_STATUSES.includes(status as (typeof BOOKING_CANCELLED_STATUSES)[number]);
