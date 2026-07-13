export const PENDING_BOOKING_EXPIRY_MS = 2 * 60 * 60 * 1000;

export const EXPLICIT_CARD_CHECKOUT_CANCEL_REASON =
  '카드 결제창에서 결제를 취소함 (승인 전)';
export const STALE_CARD_CHECKOUT_CANCEL_REASON =
  '카드 결제 미완료 (2시간 경과 자동 취소)';
export const STALE_PAYPAL_CHECKOUT_CANCEL_REASON =
  'PayPal 결제 미완료 (2시간 경과 자동 취소)';
export const STALE_PAYMENT_CHECKOUT_CANCEL_REASON =
  '결제 미완료 (2시간 경과 자동 취소)';
export const BANK_TRANSFER_EXPIRED_CANCEL_REASON =
  '입금 기한 만료 (2시간 경과 자동 취소)';
export const CARD_APPROVAL_RELEASE_RACE_LOCK_REASON =
  '카드 결제창 취소와 승인 응답 경합 처리 중';
export const CARD_APPROVAL_RELEASE_RACE_REFUNDED_REASON =
  '카드 결제창 취소와 승인 응답이 겹쳐 자동 승인취소 완료';

export function getPendingBookingExpiryCutoff(now = Date.now()) {
  return new Date(now - PENDING_BOOKING_EXPIRY_MS).toISOString();
}

export function getExpiredPendingBookingCancelReason(paymentMethod?: string | null) {
  const normalizedMethod = String(paymentMethod || '').toLowerCase();
  if (normalizedMethod === 'bank') return BANK_TRANSFER_EXPIRED_CANCEL_REASON;
  if (normalizedMethod === 'card') return STALE_CARD_CHECKOUT_CANCEL_REASON;
  if (normalizedMethod === 'paypal') return STALE_PAYPAL_CHECKOUT_CANCEL_REASON;
  return STALE_PAYMENT_CHECKOUT_CANCEL_REASON;
}
