import { DEFAULT_SOLO_GUARANTEE_PRICE } from '@/app/constants/soloGuarantee';

export type SoloGuaranteeRefundStatus =
  | 'not_applicable'
  | 'processing'
  | 'pending_manual'
  | 'refunded'
  | 'failed'
  | 'unknown'
  | 'accepted'
  | 'rejected'
  | 'reconciliation_required';
// Unknown and accepted-but-unapplied outcomes remain payout/cancellation holds.

const UNRESOLVED_SOLO_GUARANTEE_REFUND_STATUSES = new Set<string>([
  'processing',
  'pending_manual',
  'failed',
  'unknown',
  'accepted',
  'rejected',
  'reconciliation_required',
]);

export function normalizeSoloGuaranteeRefundStatus(
  status?: string | null
): SoloGuaranteeRefundStatus {
  const normalized = String(status || '').trim().toLowerCase();

  if (
    normalized === 'processing' ||
    normalized === 'pending_manual' ||
    normalized === 'refunded' ||
    normalized === 'failed' || normalized === 'unknown' || normalized === 'accepted' ||
    normalized === 'rejected' || normalized === 'reconciliation_required'
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

function formatRefundAmount(amount?: number | string | null) {
  const parsed = Number(amount ?? DEFAULT_SOLO_GUARANTEE_PRICE);
  const safeAmount = Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_SOLO_GUARANTEE_PRICE;
  return safeAmount.toLocaleString('ko-KR');
}

export function getSoloGuaranteeRefundGuestLabel(status?: string | null, amount?: number | string | null, locale = 'ko') {
  const normalized = normalizeSoloGuaranteeRefundStatus(status);
  const value = `₩${formatRefundAmount(amount)}`;
  const messages: Record<string, [string, string, string]> = {
    ko: [`1인 진행 추가금 ${formatRefundAmount(amount)}원 환불 완료`, '관리자 확인 후 1인 진행 추가금 환불 예정', '1인 진행 추가금 환불 확인 중'],
    en: [`Solo guarantee add-on ${value} refunded`, 'Solo guarantee refund awaiting external confirmation', 'Solo guarantee refund under review'],
    ja: [`1名催行追加料金${value}の返金完了`, '1名催行追加料金の返金確認待ち', '1名催行追加料金の返金確認中'],
    zh: [`单人成行附加费${value}已退款`, '单人成行附加费等待退款确认', '单人成行附加费退款确认中'],
  };
  const copy = messages[locale] || messages.ko;
  if (normalized === 'refunded') return copy[0];
  if (normalized === 'pending_manual') return copy[1];
  if (isSoloGuaranteeRefundUnresolvedStatus(normalized)) return copy[2];
  return null;
}
