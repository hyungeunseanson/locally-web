// Deliberately limited to the two reviewed attempts. C is never fenced.
export const TARGETED_NICEPAY_CLOSEOUT_IDS = [
  'ORD-20261008232253248-691',
  'ORD-20261008232336792-577',
] as const;
export const TARGETED_NICEPAY_PROTECTED_ID = 'ORD-20261009014356883-813';
export function isTargetedNicePayCloseout(orderId: string | null | undefined) {
  return TARGETED_NICEPAY_CLOSEOUT_IDS.some((id) => id === orderId);
}
export function assertNicePayApprovalNotRetired(orderId: string) {
  if (isTargetedNicePayCloseout(orderId)) {
    throw new Error('TARGETED_CARD_ATTEMPT_CLOSED: 종료 대상 결제 시도입니다. 정상 확정 예약을 확인해 주세요.');
  }
}
