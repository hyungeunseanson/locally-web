export type SoloGuaranteeRefundStatus =
  | 'not_applicable'
  | 'processing'
  | 'pending_manual'
  | 'refunded'
  | 'failed';

const UNRESOLVED_SOLO_GUARANTEE_REFUND_STATUSES = new Set<string>([
  'processing',
  'pending_manual',
  'failed',
]);

export function normalizeSoloGuaranteeRefundStatus(
  status?: string | null
): SoloGuaranteeRefundStatus {
  const normalized = String(status || '').trim().toLowerCase();

  if (
    normalized === 'processing' ||
    normalized === 'pending_manual' ||
    normalized === 'refunded' ||
    normalized === 'failed'
  ) {
    return normalized;
  }

  return 'not_applicable';
}

export function isSoloGuaranteeRefundUnresolvedStatus(status?: string | null) {
  return UNRESOLVED_SOLO_GUARANTEE_REFUND_STATUSES.has(
    normalizeSoloGuaranteeRefundStatus(status)
  );
}

export function getSoloGuaranteeRefundGuestLabel(status?: string | null) {
  const normalized = normalizeSoloGuaranteeRefundStatus(status);

  if (normalized === 'refunded') {
    return '1인 진행 추가금 30,000원 환불 완료';
  }

  if (normalized === 'pending_manual') {
    return '관리자 확인 후 1인 진행 추가금 환불 예정';
  }

  if (normalized === 'processing' || normalized === 'failed') {
    return '1인 진행 추가금 환불 확인 중';
  }

  return null;
}
