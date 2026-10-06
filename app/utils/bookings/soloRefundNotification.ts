import type { CardPaymentNotificationEnvelope } from '@/app/utils/payments/card/types';

type SoloRefundBooking = {
  id: string;
  order_id?: string | null;
  tid?: string | null;
  status: string;
  payment_method?: string | null;
  solo_guarantee_refund_status?: string | null;
};

type SoloRefundNotificationOperation = {
  booking_id: string;
  provider: string;
  payment_method: string;
  transaction_reference: string | null;
  order_reference: string;
  requested_amount: number;
  outcome: string;
  settlement_applied_at: string | null;
};

export function isSoloRefundNotificationForBooking(params: {
  notification: CardPaymentNotificationEnvelope;
  booking: SoloRefundBooking;
}) {
  const { notification, booking } = params;
  const bookingOrder = booking.order_id || booking.id;

  return (
    notification.provider === 'nicepay' &&
    notification.payload.StateCd === '2' &&
    notification.payload.PayMethod?.toUpperCase() === 'CARD' &&
    booking.status === 'completed' &&
    booking.payment_method === 'card' &&
    booking.solo_guarantee_refund_status === 'refunded' &&
    Boolean(booking.id && bookingOrder && booking.tid) &&
    notification.orderId === bookingOrder &&
    notification.originalOrderId === bookingOrder &&
    // Generic aliases must not mask a conflicting official NICEPAY TID/Amt.
    notification.payload.TID === booking.tid &&
    notification.providerTransactionId === booking.tid &&
    Boolean(notification.cancelOrderId) &&
    notification.amount != null &&
    /^\d+$/.test(notification.payload.Amt || '') &&
    Number(notification.payload.Amt) === notification.amount &&
    Number.isSafeInteger(notification.amount) &&
    notification.amount > 0
  );
}

// ACK only durable, already-applied evidence. Never dispatch a refund, reapply
// settlement, or accept a booking's aggregate refund_amount as proof.
export function isMatchingAppliedSoloNicePayRefund(params: {
  notification: CardPaymentNotificationEnvelope;
  booking: SoloRefundBooking;
  operation: SoloRefundNotificationOperation | null;
}) {
  const { notification, booking, operation } = params;
  if (!operation || !isSoloRefundNotificationForBooking(params)) return false;

  return (
    operation.booking_id === booking.id &&
    operation.provider === 'nicepay' &&
    operation.payment_method === 'card' &&
    operation.transaction_reference === booking.tid &&
    operation.transaction_reference === notification.providerTransactionId &&
    operation.order_reference === notification.cancelOrderId &&
    operation.requested_amount === notification.amount &&
    operation.outcome === 'accepted' &&
    Boolean(operation.settlement_applied_at)
  );
}
