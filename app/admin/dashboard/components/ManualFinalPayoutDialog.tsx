'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';

import type {
  AdminCombinedPayoutQueueRow,
  AdminManualPayoutPreview,
  AdminManualPayoutType,
} from '@/app/types/admin';

type Props = {
  row: AdminCombinedPayoutQueueRow;
  onClose: () => void;
  onCompleted: () => Promise<void> | void;
};

type PreviewResponse = {
  success: boolean;
  error?: string;
  preview?: AdminManualPayoutPreview;
};

export default function ManualFinalPayoutDialog({ row, onClose, onCompleted }: Props) {
  const [preview, setPreview] = useState<AdminManualPayoutPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState('');
  const [settlementType, setSettlementType] = useState<AdminManualPayoutType>('host_exit_final');
  const [legacyAmountInput, setLegacyAmountInput] = useState('');
  const [reason, setReason] = useState('');
  const [legacySourceReference, setLegacySourceReference] = useState('');
  const [transferReference, setTransferReference] = useState('');
  const [confirmedTransfer, setConfirmedTransfer] = useState(false);
  const [confirmedHostExit, setConfirmedHostExit] = useState(false);

  useEffect(() => {
    setRequestKey(crypto.randomUUID());
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch('/api/admin/manual-payouts/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hostId: row.host_id }),
        });
        const json = (await response.json()) as PreviewResponse;
        if (!response.ok || !json.success || !json.preview) {
          throw new Error(json.error || '수동 정산 정보를 확인하지 못했습니다.');
        }
        if (!cancelled) setPreview(json.preview);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : '미리보기 오류');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [row.host_id]);

  const legacyAmount = settlementType === 'legacy_carryover' ? Number(legacyAmountInput || 0) : 0;
  const totalPaidAmount = (preview?.current_booking_amount ?? 0) + (Number.isFinite(legacyAmount) ? legacyAmount : 0);
  const activeBlockers = useMemo(() => {
    if (!preview) return [];
    return settlementType === 'host_exit_final'
      ? [...preview.blockers, ...preview.host_exit_blockers]
      : preview.blockers;
  }, [preview, settlementType]);

  const canSubmit = Boolean(
    preview &&
      requestKey &&
      activeBlockers.length === 0 &&
      reason.trim() &&
      transferReference.trim() &&
      confirmedTransfer &&
      (settlementType !== 'host_exit_final' || confirmedHostExit) &&
      (settlementType !== 'legacy_carryover' ||
        (Number.isInteger(legacyAmount) && legacyAmount > 0 && legacySourceReference.trim()))
  );

  const submit = async () => {
    if (!preview || !canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/manual-payouts/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestKey,
          hostId: row.host_id,
          settlementType,
          expectedCurrentBookingAmount: preview.current_booking_amount,
          legacyAmount,
          reason: reason.trim(),
          legacySourceReference:
            settlementType === 'legacy_carryover' ? legacySourceReference.trim() : undefined,
          transferReference: transferReference.trim(),
        }),
      });
      const json = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !json.success) throw new Error(json.error || '수동 정산 처리에 실패했습니다.');
      await onCompleted();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '수동 정산 처리에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-bold text-slate-900">수동 최종 정산</h3>
            <p className="text-xs text-slate-500">{row.host_name}</p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="닫기" className="rounded-lg p-2 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 size={18} className="animate-spin" /> 최신 미정산 상태 확인 중
            </div>
          ) : preview ? (
            <>
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
                <div><p className="text-xs text-slate-500">신규 사이트 미정산</p><p className="font-bold">₩{preview.current_booking_amount.toLocaleString()} · {preview.booking_count}건</p></div>
                <div><p className="text-xs text-slate-500">지급 계좌</p><p className="font-bold">{preview.bank_name} {preview.account_number}</p><p className="text-xs text-slate-500">{preview.account_holder}</p></div>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-bold text-slate-800">정산 유형</legend>
                <label className="flex gap-2 rounded-lg border p-3 text-sm"><input type="radio" checked={settlementType === 'host_exit_final'} onChange={() => setSettlementType('host_exit_final')} /> 활동 종료 최종 정산</label>
                <label className="flex gap-2 rounded-lg border p-3 text-sm"><input type="radio" checked={settlementType === 'legacy_carryover'} onChange={() => setSettlementType('legacy_carryover')} /> 이전 사이트 이월</label>
              </fieldset>

              {settlementType === 'legacy_carryover' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700">Legacy 이월액<input type="number" min="1" step="1" value={legacyAmountInput} onChange={(event) => setLegacyAmountInput(event.target.value)} className="mt-1 w-full rounded-lg border-slate-300" /></label>
                  <label className="text-sm font-medium text-slate-700">Legacy 출처/참조<input value={legacySourceReference} onChange={(event) => setLegacySourceReference(event.target.value)} maxLength={500} className="mt-1 w-full rounded-lg border-slate-300" placeholder="이전 사이트 주문/정산 참조" /></label>
                </div>
              )}

              <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
                <p className="text-xs font-medium text-purple-700">실제 지급액</p>
                <p className="text-2xl font-black text-purple-900">₩{totalPaidAmount.toLocaleString()}</p>
                {settlementType === 'legacy_carryover' && <p className="text-xs text-purple-700">신규 ₩{preview.current_booking_amount.toLocaleString()} + legacy ₩{Math.max(0, legacyAmount).toLocaleString()}</p>}
              </div>

              <label className="block text-sm font-medium text-slate-700">정산 사유<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={3} className="mt-1 w-full rounded-lg border-slate-300" /></label>
              <label className="block text-sm font-medium text-slate-700">은행 이체 참조값<input value={transferReference} onChange={(event) => setTransferReference(event.target.value)} maxLength={500} className="mt-1 w-full rounded-lg border-slate-300" placeholder="이체일시/메모/거래 참조" /></label>

              {activeBlockers.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><p className="mb-1 flex items-center gap-1 font-bold"><AlertTriangle size={15} /> 처리 불가</p>{activeBlockers.map((item) => <p key={item}>• {item}</p>)}</div>}
              {preview.warnings.map((warning) => <p key={warning} className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">{warning}</p>)}

              {settlementType === 'host_exit_final' && <label className="flex gap-2 text-sm text-slate-700"><input type="checkbox" checked={confirmedHostExit} onChange={(event) => setConfirmedHostExit(event.target.checked)} /> 호스트의 향후 활동과 지급 가능성을 최종 확인했습니다.</label>}
              <label className="flex gap-2 text-sm font-bold text-slate-800"><input type="checkbox" checked={confirmedTransfer} onChange={(event) => setConfirmedTransfer(event.target.checked)} /> 위 계좌로 ₩{totalPaidAmount.toLocaleString()}을 실제 이체했습니다.</label>
            </>
          ) : null}

          {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-lg border px-4 py-2 text-sm font-bold text-slate-600">취소</button>
          <button type="button" onClick={() => void submit()} disabled={!canSubmit || submitting} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
            {submitting ? '원자 처리 중…' : '수동 정산 완료 기록'}
          </button>
        </div>
      </div>
    </div>
  );
}
