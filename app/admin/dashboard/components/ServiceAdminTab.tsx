'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Briefcase, DollarSign, RefreshCcw, CheckCircle, AlertTriangle, ChevronDown, ChevronUp,
  X, Loader2, Download, Pencil, Search, UserCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/app/context/ToastContext';
import { useConfirmDialog } from '@/app/hooks/useConfirmDialog';
import { useServiceAdminData } from '../hooks/useServiceAdminData';
import { AdminServiceBooking } from '@/app/types/admin';

// ── 상태 라벨 헬퍼 ──────────────────────────────────────────────────────────
const BOOKING_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: '결제 대기', cls: 'bg-amber-50 text-amber-700' },
  PAID: { label: '결제 완료', cls: 'bg-blue-50 text-blue-700' },
  confirmed: { label: '확정', cls: 'bg-indigo-50 text-indigo-700' },
  completed: { label: '완료', cls: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: '취소', cls: 'bg-red-50 text-red-600' },
  cancellation_requested: { label: '취소 요청', cls: 'bg-orange-50 text-orange-700' },
};

const REQUEST_STATUS_LABELS: Record<string, string> = {
  pending_payment: '결제 대기',
  assigning: '관리자 배정 중',
  open: '관리자 배정 중(레거시)',
  matched: '매칭 완료',
  confirmed: '확정',
  completed: '완료',
  cancelled: '취소',
  expired: '만료',
};

const EDITABLE_REQUEST_STATUSES = new Set(['pending_payment', 'assigning', 'open']);

type RefundOperation = AdminServiceBooking['refund_operations'][number];

function getUnresolvedRefundOperation(booking: AdminServiceBooking) {
  return booking.refund_operations.find((operation) => ['started', 'unknown'].includes(operation.status)) ?? null;
}

function getRowActionCopy(booking: AdminServiceBooking) {
  if (getUnresolvedRefundOperation(booking)) {
    return {
      text: '환불 결과가 확정되지 않았습니다. 재환불하지 말고 결제사 내역을 대조해주세요.',
      cls: 'text-red-700',
    };
  }
  if (booking.status === 'PENDING' && booking.payment_method === 'bank') {
    return {
      text: '입금 확인 시 현지 담당자 1:1 문의와 호스트 배정 대기가 시작됩니다.',
      cls: 'text-blue-600',
    };
  }
  if (booking.status === 'cancellation_requested') {
    return {
      text: '환불 취소 여부를 먼저 확인해주세요. 결제 후 취소는 환불까지 함께 처리됩니다.',
      cls: 'text-orange-600',
    };
  }
  if (booking.status === 'cancelled') {
    return {
      text: '취소·환불 내역에서 환불액과 사유를 다시 확인할 수 있습니다.',
      cls: 'text-slate-400',
    };
  }
  if ((booking.status === 'PAID' || booking.status === 'confirmed') && !booking.host_id) {
    return {
      text: '결제가 완료되어 관리자가 호스트를 배정해야 합니다.',
      cls: 'text-indigo-600',
    };
  }
  if (booking.status === 'completed' && booking.host_id && booking.payout_status === 'pending') {
    return {
      text: '서비스 완료 후에는 정산 대기 탭에서 이체 완료 처리가 필요합니다.',
      cls: 'text-emerald-600',
    };
  }
  if ((booking.status === 'PAID' || booking.status === 'confirmed') && booking.host_id && booking.payout_status !== 'paid') {
    return {
      text: '서비스 종료 후 자동 완료 처리되면 정산 대기 탭에서 이체를 진행할 수 있습니다.',
      cls: 'text-slate-500',
    };
  }
  return {
    text: '현재 상태와 결제 상태를 함께 확인해주세요.',
    cls: 'text-slate-400',
  };
}

function statusBadge(status: string, map: Record<string, { label: string; cls: string }>) {
  const cfg = map[status] ?? { label: status, cls: 'bg-slate-50 text-slate-500' };
  return (
    <span className={`px-2 py-0.5 rounded text-[9px] md:text-[10px] font-bold whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ── 의뢰 내용 수정 모달 ─────────────────────────────────────────────────────
function EditRequestModal({
  requestId,
  initialDescription,
  onClose,
  onSuccess,
}: {
  requestId: string;
  initialDescription: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { showToast } = useToast();
  const [description, setDescription] = useState(initialDescription);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!description.trim()) { showToast('요청 내용을 입력해주세요.', 'error'); return; }
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/service-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { showToast(data.error || '수정 실패', 'error'); return; }
      showToast('의뢰 내용이 수정되었습니다.', 'success');
      onSuccess();
      onClose();
    } catch { showToast('서버 오류가 발생했습니다.', 'error'); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-[15px] md:text-base text-slate-900">의뢰 내용 수정</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 transition-colors"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">요청 내용</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[13px] md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-[12px] md:text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">취소</button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-[12px] md:text-sm font-bold hover:bg-slate-800 transition-colors disabled:opacity-60"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 강제 취소 모달 ──────────────────────────────────────────────────────────
type AssignableHost = {
  id: string;
  name: string;
  email: string | null;
  languages: string[];
  nationality: string | null;
  activeExperiences: Array<{ title: string; city: string | null; country: string | null }>;
};

function AssignHostModal({ booking, onClose, onSuccess }: { booking: AdminServiceBooking; onClose: () => void; onSuccess: () => void }) {
  const { showToast } = useToast();
  const serviceRequest = booking.service_request;
  const [hosts, setHosts] = useState<AssignableHost[]>([]);
  const [query, setQuery] = useState('');
  const [selectedHostId, setSelectedHostId] = useState('');
  const [hostHourlyRate, setHostHourlyRate] = useState(serviceRequest?.pricing_tier === 'standard' ? 20_000 : 30_000);
  const [agreement, setAgreement] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void fetch('/api/admin/service-hosts', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || '호스트 목록 조회 실패');
        setHosts(result.data || []);
      })
      .catch((error) => showToast(error instanceof Error ? error.message : '호스트 목록 조회 실패', 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  if (!serviceRequest) return null;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredHosts = hosts.filter((host) => !normalizedQuery || [host.name, host.email, host.nationality, ...host.languages, ...host.activeExperiences.flatMap((experience) => [experience.city, experience.title])].some((value) => String(value || '').toLowerCase().includes(normalizedQuery)));
  const payout = hostHourlyRate * serviceRequest.duration_hours;

  const submit = async () => {
    if (!selectedHostId || !agreement) return showToast('호스트 선택과 일정·보수 동의 확인이 필요합니다.', 'error');
    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/service-requests/${booking.request_id}/assign-host`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: selectedHostId, hostHourlyRate, hostAgreementConfirmed: true }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || '배정 실패');
      showToast('호스트 배정과 고객-호스트 문의 생성이 완료되었습니다.', 'success');
      onSuccess();
      onClose();
    } catch (error) {
      showToast(error instanceof Error ? error.message : '배정 실패', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div><h3 className="text-lg font-black">호스트 직접 배정</h3><p className="mt-1 text-xs text-slate-500">{serviceRequest.city} · {serviceRequest.duration_hours}시간 · {serviceRequest.guest_count}명 · {serviceRequest.pricing_tier === 'standard' ? '표준' : '프리미엄'}</p></div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="relative mt-5"><Search className="absolute left-3 top-3 text-slate-400" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름, 언어, 도시, 체험으로 검색" className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm" /></div>
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {loading ? <p className="py-10 text-center text-sm text-slate-400">불러오는 중…</p> : filteredHosts.map((host) => (
            <button type="button" key={host.id} onClick={() => setSelectedHostId(host.id)} className={`w-full rounded-xl border p-3 text-left ${selectedHostId === host.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between"><p className="text-sm font-black">{host.name}</p><span className="text-[10px] text-slate-400">{host.email}</span></div>
              <p className="mt-1 text-xs text-slate-500">{host.languages.join(' · ') || '언어 미등록'} {host.activeExperiences.length ? `· 활성 체험 ${host.activeExperiences.length}개` : ''}</p>
            </button>
          ))}
        </div>
        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          <label className="text-xs font-bold">호스트 시간당 보수<input type="number" min={1} max={serviceRequest.hourly_rate_customer} step={1000} disabled={serviceRequest.pricing_tier === 'standard'} value={hostHourlyRate} onChange={(event) => setHostHourlyRate(Number(event.target.value))} className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm disabled:bg-slate-100" /></label>
          <p className="mt-2 text-xs text-slate-500">예상 총 지급액: <strong className="text-emerald-700">₩{payout.toLocaleString()}</strong>{serviceRequest.pricing_tier === 'standard' && ' · 표준 보수는 시간당 20,000원으로 고정'}</p>
        </div>
        <label className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold leading-5 text-amber-900"><input type="checkbox" checked={agreement} onChange={(event) => setAgreement(event.target.checked)} className="mt-1" />호스트와 모든 일정, 시간, 총 보수를 사전에 확인했습니다.</label>
        <button type="button" disabled={submitting || !selectedHostId || !agreement} onClick={submit} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-4 text-sm font-black text-white disabled:opacity-40">{submitting ? <Loader2 size={16} className="animate-spin" /> : <UserCheck size={16} />}배정 확정</button>
      </div>
    </div>
  );
}

function ForceCancelModal({
  booking,
  onClose,
  onSuccess,
}: {
  booking: AdminServiceBooking;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { showToast } = useToast();
  const { requestConfirm, ConfirmDialogElement } = useConfirmDialog();
  const isFullRefund = booking.status === 'PAID' && !booking.host_id && ['assigning', 'open', 'pending_payment'].includes(booking.service_request?.status || '');
  const [refundAmt, setRefundAmt] = useState(booking.amount);
  const [hostCompensationAmt, setHostCompensationAmt] = useState(0);
  const [manualRefundConfirmed, setManualRefundConfirmed] = useState(false);
  const [reason, setReason] = useState('관리자 강제 취소');
  const [isProcessing, setIsProcessing] = useState(false);
  const idempotencyKey = useRef<string | null>(null);

  const handleSubmit = () => {
    requestConfirm({
      title: '강제 취소',
      description: `고객 환불 ₩${refundAmt.toLocaleString()}, 호스트 보상 ₩${hostCompensationAmt.toLocaleString()}으로 취소하시겠습니까?`,
      confirmLabel: '강제 취소',
      tone: 'red',
    }, async () => {
      setIsProcessing(true);
      try {
        idempotencyKey.current ||= `admin-ui:${crypto.randomUUID()}`;
        const res = await fetch('/api/admin/service-cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: booking.order_id, refund_amount: refundAmt, host_compensation_amount: hostCompensationAmt, cancel_reason: reason, manual_refund_confirmed: manualRefundConfirmed, idempotency_key: idempotencyKey.current }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          if (data.code === 'REFUND_RECONCILIATION_REQUIRED' || data.code === 'REFUND_DB_RECONCILIATION_REQUIRED') {
            showToast(data.error || '결제사 결과 대조가 필요합니다.', 'error');
            onSuccess();
            onClose();
            return;
          }
          if (data.code === 'REFUND_FAILED') idempotencyKey.current = null;
          showToast(data.error || '취소 실패', 'error');
          return;
        }
        showToast('강제 취소 완료', 'success');
        onSuccess();
        onClose();
      } catch {
        showToast('서버 오류', 'error');
      } finally {
        setIsProcessing(false);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 md:p-8 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[15px] md:text-lg font-black text-slate-900">강제 취소 / 환불</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 mb-5 text-[11px] md:text-xs text-slate-600 space-y-1">
          <p><span className="font-bold text-slate-700">주문번호:</span> {booking.order_id}</p>
          <p><span className="font-bold text-slate-700">의뢰:</span> {booking.service_request?.title || '-'}</p>
          <p><span className="font-bold text-slate-700">결제액:</span> ₩{booking.amount.toLocaleString()}</p>
          <p><span className="font-bold text-slate-700">결제 상태:</span> {booking.status}</p>
        </div>

        <div className={`rounded-xl border px-4 py-3 mb-5 text-[11px] md:text-xs leading-relaxed ${
          booking.status === 'PENDING'
            ? 'bg-amber-50 border-amber-200 text-amber-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {booking.status === 'PENDING'
            ? '결제 전 상태입니다. 이 경우 PG 환불 없이 예약과 의뢰만 취소됩니다.'
            : '이미 결제된 예약입니다. 이 경우 환불 후 취소되며, 환불 금액과 사유를 함께 다시 확인해야 합니다.'}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[11px] md:text-xs font-bold text-slate-700 mb-1.5">환불 금액</label>
            {booking.status === 'PENDING' ? (
              <p className="text-[11px] md:text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-3">결제 전 — PG 환불 없음 (DB 취소만 진행)</p>
            ) : (
              <input
                type="number"
                value={refundAmt}
                onChange={e => setRefundAmt(Number(e.target.value))}
                min={0}
                max={booking.amount}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            )}
            {isFullRefund && booking.status !== 'PENDING' && (
              <p className="text-[10px] md:text-xs text-emerald-600 mt-1">호스트 미선택 상태 → 전액 환불 권장</p>
            )}
          </div>

          {booking.host_id && booking.status !== 'PENDING' && (
            <div>
              <label className="block text-[11px] md:text-xs font-bold text-slate-700 mb-1.5">호스트 보상액 (고객 환불과 별도)</label>
              <input type="number" value={hostCompensationAmt} onChange={e => setHostCompensationAmt(Number(e.target.value))} min={0} max={booking.host_payout_amount || 0} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] md:text-sm" />
              <p className="mt-1 text-[10px] text-slate-500">최대 호스트 예정 지급액 ₩{(booking.host_payout_amount || 0).toLocaleString()}. 고객 환불액에서 차감하지 않습니다.</p>
            </div>
          )}

          {booking.payment_method === 'bank' && booking.status !== 'PENDING' && refundAmt > 0 && (
            <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold leading-5 text-amber-900"><input type="checkbox" checked={manualRefundConfirmed} onChange={e => setManualRefundConfirmed(e.target.checked)} className="mt-1" />고객 계좌로 환불 이체를 실제로 완료했습니다.</label>
          )}

          <div>
            <label className="block text-[11px] md:text-xs font-bold text-slate-700 mb-1.5">취소 사유</label>
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-[13px] md:text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isProcessing}
            className="flex-1 py-3 rounded-xl bg-red-600 text-white text-[13px] md:text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isProcessing ? <><Loader2 size={14} className="animate-spin" /> 처리 중...</> : '강제 취소 실행'}
          </button>
        </div>
      </div>
      {ConfirmDialogElement}
    </div>
  );
}

function RefundReconciliationModal({
  booking,
  operation,
  onClose,
  onSuccess,
}: {
  booking: AdminServiceBooking;
  operation: RefundOperation;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { showToast } = useToast();
  const { requestConfirm, ConfirmDialogElement } = useConfirmDialog();
  const [providerReference, setProviderReference] = useState(operation.provider_reference || '');
  const [isProcessing, setIsProcessing] = useState(false);

  const reconcile = (outcome: 'succeeded' | 'failed') => {
    requestConfirm({
      title: outcome === 'succeeded' ? '환불 성공으로 마감' : '환불 실패로 마감',
      description: outcome === 'succeeded'
        ? '결제사 관리자 화면에서 환불 완료를 직접 확인했습니까? 이 작업은 환불을 다시 실행하지 않고 예약을 취소 상태로 마감합니다.'
        : '결제사 관리자 화면에서 환불 실패를 직접 확인했습니까? 예약과 의뢰를 환불 전 상태로 복구합니다.',
      confirmLabel: outcome === 'succeeded' ? '확인했고 성공 마감' : '확인했고 실패 마감',
      tone: outcome === 'succeeded' ? 'default' : 'red',
    }, async () => {
      setIsProcessing(true);
      try {
        const response = await fetch('/api/admin/service-refunds/reconcile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operationId: operation.id,
            outcome,
            providerVerified: true,
            providerReference: providerReference.trim() || null,
          }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || '환불 대조 마감 실패');
        showToast(result.message || '환불 대조 결과를 반영했습니다.', 'success');
        onSuccess();
        onClose();
      } catch (error) {
        showToast(error instanceof Error ? error.message : '환불 대조 마감 실패', 'error');
      } finally {
        setIsProcessing(false);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-900">환불 결과 대조</h3>
            <p className="mt-1 text-xs text-slate-500">주문 {booking.order_id}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>

        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs leading-5 text-red-800">
          <p className="font-black">이 화면에서는 환불을 다시 실행하지 않습니다.</p>
          <p className="mt-1">PayPal·카드사 관리자 화면에서 실제 결과를 먼저 확인한 뒤, 그 결과만 Locally에 반영하세요.</p>
        </div>

        <dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-2 rounded-xl bg-slate-50 p-4 text-xs">
          <dt className="font-bold text-slate-500">환불액</dt><dd className="font-black">₩{operation.refund_amount.toLocaleString()}</dd>
          <dt className="font-bold text-slate-500">호스트 보상</dt><dd>₩{operation.host_compensation_amount.toLocaleString()}</dd>
          <dt className="font-bold text-slate-500">현재 기록</dt><dd>{operation.status === 'unknown' ? '결과 불명확' : '마감 중단'}</dd>
          {operation.error_message && <><dt className="font-bold text-slate-500">마지막 오류</dt><dd className="break-all text-red-700">{operation.error_message}</dd></>}
        </dl>

        <label className="mt-4 block text-xs font-bold text-slate-700">
          결제사 환불/거래 번호 (선택)
          <input value={providerReference} onChange={(event) => setProviderReference(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="결제사 관리자 화면의 확인 번호" />
        </label>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" disabled={isProcessing} onClick={() => reconcile('failed')} className="rounded-xl border border-slate-300 px-3 py-3 text-xs font-black text-slate-700 disabled:opacity-50">환불 실패 확인</button>
          <button type="button" disabled={isProcessing} onClick={() => reconcile('succeeded')} className="rounded-xl bg-red-600 px-3 py-3 text-xs font-black text-white disabled:opacity-50">환불 완료 확인</button>
        </div>
      </div>
      {ConfirmDialogElement}
    </div>
  );
}

// ── 서브탭 1: 전체 의뢰 목록 ────────────────────────────────────────────────
type AllFilter = 'ALL' | 'CANCEL_REQ';

function AllRequestsTab({ bookings, onRefresh }: { bookings: AdminServiceBooking[]; onRefresh: () => void }) {
  const { showToast } = useToast();
  const { requestConfirm, ConfirmDialogElement } = useConfirmDialog();
  const [cancelTarget, setCancelTarget] = useState<AdminServiceBooking | null>(null);
  const [editTarget, setEditTarget] = useState<AdminServiceBooking | null>(null);
  const [assignmentTarget, setAssignmentTarget] = useState<AdminServiceBooking | null>(null);
  const [reconcileTarget, setReconcileTarget] = useState<{ booking: AdminServiceBooking; operation: RefundOperation } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [allFilter, setAllFilter] = useState<AllFilter>('ALL');

  const cancelReqCount = bookings.filter(b => b.status === 'cancellation_requested').length;
  const pendingBankCount = bookings.filter(b => b.status === 'PENDING' && b.payment_method === 'bank').length;
  const settlementPendingCount = bookings.filter(
    b => ['PAID', 'confirmed', 'completed'].includes(b.status) && b.payout_status === 'pending' && b.host_id
  ).length;
  const unresolvedRefundCount = bookings.filter((booking) => getUnresolvedRefundOperation(booking)).length;
  const displayedBookings = allFilter === 'CANCEL_REQ'
    ? bookings.filter(b => b.status === 'cancellation_requested')
    : bookings;

  const handleConfirmPayment = (orderId: string) => {
    requestConfirm({
      title: '입금 확인',
      description: '입금이 확인되었습니까? 현지 담당자 1:1 문의를 열고 호스트 배정 대기로 전환합니다.',
      confirmLabel: '입금 확인',
      tone: 'default',
    }, async () => {
      setIsProcessing(true);
      try {
        const res = await fetch('/api/admin/service-confirm-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          showToast(data.error || '처리 실패', 'error');
          return;
        }
        showToast('입금 확인 완료. 현지 담당자 1:1 문의가 생성되었습니다.', 'success');
        onRefresh();
      } catch {
        showToast('서버 오류가 발생했습니다.', 'error');
      } finally {
        setIsProcessing(false);
      }
    });
  };

  return (
    <div className="space-y-3 md:space-y-4">
      {cancelTarget && (
        <ForceCancelModal
          booking={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onSuccess={onRefresh}
        />
      )}
      {editTarget && editTarget.service_request && (
        <EditRequestModal
          requestId={editTarget.request_id}
          initialDescription={editTarget.service_request.description ?? ''}
          onClose={() => setEditTarget(null)}
          onSuccess={onRefresh}
        />
      )}
      {assignmentTarget && (
        <AssignHostModal
          booking={assignmentTarget}
          onClose={() => setAssignmentTarget(null)}
          onSuccess={onRefresh}
        />
      )}
      {reconcileTarget && (
        <RefundReconciliationModal
          booking={reconcileTarget.booking}
          operation={reconcileTarget.operation}
          onClose={() => setReconcileTarget(null)}
          onSuccess={onRefresh}
        />
      )}

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 md:px-5 md:py-4">
        <div className="flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="space-y-2">
            <div>
              <p className="text-[12px] md:text-sm font-black text-slate-900">운영 빠른 안내</p>
              <p className="text-[10px] md:text-xs text-slate-600 mt-0.5">
                무통장 입금 확인 후 현지 담당자 1:1 문의가 열리고 배정 대기로 전환됩니다. 결제 전 취소는 DB만, 결제 후 취소는 환불 작업 이력과 함께 처리합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] md:text-xs font-bold text-blue-700 border border-blue-100">
                입금 확인 필요 {pendingBankCount}건
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] md:text-xs font-bold text-orange-700 border border-orange-100">
                취소 검토 {cancelReqCount}건
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] md:text-xs font-bold text-emerald-700 border border-emerald-100">
                정산 대기 {settlementPendingCount}건
              </span>
              <span className={`rounded-full bg-white px-2.5 py-1 text-[10px] md:text-xs font-bold border ${unresolvedRefundCount > 0 ? 'border-red-200 text-red-700' : 'border-slate-100 text-slate-500'}`}>
                환불 대조 {unresolvedRefundCount}건
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 필터 필 */}
      <div className="flex gap-2">
        <button
          onClick={() => setAllFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg text-[11px] md:text-xs font-bold transition-colors ${allFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
        >
          전체
        </button>
        <button
          onClick={() => setAllFilter('CANCEL_REQ')}
          className={`px-3 py-1.5 rounded-lg text-[11px] md:text-xs font-bold transition-colors flex items-center gap-1 ${allFilter === 'CANCEL_REQ' ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
        >
          취소 요청
          {cancelReqCount > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] md:text-[10px] font-black ${allFilter === 'CANCEL_REQ' ? 'bg-white/30 text-white' : 'bg-orange-500 text-white'}`}>
              {cancelReqCount}
            </span>
          )}
        </button>
      </div>

      <div className="bg-white rounded-xl md:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm text-left min-w-[800px]">
            <thead className="bg-slate-50 text-slate-500 text-[10px] md:text-xs uppercase border-b border-slate-100">
              <tr>
                <th className="px-4 py-3">주문번호</th>
                <th className="px-4 py-3">의뢰 내용</th>
                <th className="px-4 py-3">고객</th>
                <th className="px-4 py-3">결제액</th>
                <th className="px-4 py-3">호스트 지급액</th>
                <th className="px-4 py-3">순수익</th>
                <th className="px-4 py-3">결제수단</th>
                <th className="px-4 py-3">의뢰 상태</th>
                <th className="px-4 py-3">결제 상태</th>
                <th className="px-4 py-3">정산</th>
                <th className="px-4 py-3">등록일</th>
                <th className="px-4 py-3 text-right">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayedBookings.length > 0 ? displayedBookings.map(b => {
                const actionCopy = getRowActionCopy(b);
                const unresolvedRefund = getUnresolvedRefundOperation(b);

                return (
                  <tr key={b.id} className={`hover:bg-slate-50 transition-colors ${b.status === 'cancellation_requested' ? 'bg-orange-50/40' : ''}`}>
                  <td className="px-4 py-3 font-mono text-slate-400 text-[10px] md:text-xs">
                    {b.order_id ? b.order_id.slice(-12) : b.id.slice(-8)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-[11px] md:text-sm text-slate-900 line-clamp-1">{b.service_request?.title || '-'}</p>
                    <p className="text-[10px] md:text-xs text-slate-400">{b.service_request?.city} · {b.service_request?.service_date} · {b.service_request?.duration_hours}h</p>
                    <p className={`mt-1 text-[10px] md:text-xs font-medium ${actionCopy.cls}`}>
                      {actionCopy.text}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-[10px] md:text-xs text-slate-600">
                    {b.customer_profile?.full_name || b.customer_profile?.email || b.customer_id.slice(-6)}
                  </td>
                  <td className="px-4 py-3 font-bold text-[11px] md:text-sm text-slate-900">₩{b.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[11px] md:text-sm text-emerald-700 font-semibold">
                    {b.host_payout_amount != null ? `₩${b.host_payout_amount.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-[11px] md:text-sm text-blue-700 font-semibold">
                    {b.platform_revenue != null ? `₩${b.platform_revenue.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {b.payment_method === 'bank' ? (
                      <span className="text-[9px] md:text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold whitespace-nowrap">🏛️ 무통장</span>
                    ) : (
                      <span className="text-[9px] md:text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-medium whitespace-nowrap">💳 카드</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[9px] md:text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium whitespace-nowrap">
                      {REQUEST_STATUS_LABELS[b.service_request?.status ?? ''] ?? (b.service_request?.status ?? '-')}
                    </span>
                  </td>
                  <td className="px-4 py-3">{statusBadge(b.status, BOOKING_STATUS_LABELS)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[9px] md:text-[10px] px-2 py-0.5 rounded font-bold whitespace-nowrap ${
                      b.payout_status === 'paid'
                        ? 'bg-emerald-50 text-emerald-700'
                        : b.host_id && ['completed', 'cancelled'].includes(b.status)
                          ? 'bg-yellow-50 text-yellow-700'
                          : 'bg-slate-100 text-slate-500'
                    }`}>
                      {b.payout_status === 'paid'
                        ? '정산완료'
                        : !b.host_id
                          ? '미선택'
                          : ['completed', 'cancelled'].includes(b.status)
                            ? '정산대기'
                            : '완료 후 정산'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[10px] md:text-xs text-slate-400">
                    {format(new Date(b.created_at), 'yy.MM.dd')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {unresolvedRefund && (
                        <button
                          onClick={() => setReconcileTarget({ booking: b, operation: unresolvedRefund })}
                          className="px-2 py-1 md:px-3 md:py-1.5 rounded-lg border border-red-300 bg-red-600 text-[9px] font-black text-white hover:bg-red-700 md:text-[10px]"
                        >
                          환불 대조
                        </button>
                      )}
                      <button
                        onClick={() => setEditTarget(b)}
                        disabled={!EDITABLE_REQUEST_STATUSES.has(b.service_request?.status ?? '')}
                        className={`p-1.5 rounded-lg transition-colors ${
                          EDITABLE_REQUEST_STATUSES.has(b.service_request?.status ?? '')
                            ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                        }`}
                        title={EDITABLE_REQUEST_STATUSES.has(b.service_request?.status ?? '') ? '의뢰 수정' : '결제 대기/모집 중 상태에서만 수정 가능'}
                      >
                        <Pencil size={12} />
                      </button>
                      {!unresolvedRefund && b.status !== 'cancelled' && b.service_request?.status !== 'completed' && (
                        <>
                          {b.status === 'PENDING' && b.payment_method === 'bank' && (
                            <button
                              onClick={() => handleConfirmPayment(b.order_id)}
                              disabled={isProcessing}
                              className="px-2 py-1 md:px-3 md:py-1.5 bg-blue-600 text-white border border-blue-700 rounded-lg text-[9px] md:text-[10px] font-bold whitespace-nowrap hover:bg-blue-700 transition-colors disabled:opacity-60"
                            >
                              💰 입금 확인
                            </button>
                          )}
                          {b.status === 'PAID' && !b.host_id && ['assigning', 'open'].includes(b.service_request?.status || '') && (
                            <button
                              onClick={() => setAssignmentTarget(b)}
                              className="px-2 py-1 md:px-3 md:py-1.5 bg-emerald-600 text-white border border-emerald-700 rounded-lg text-[9px] md:text-[10px] font-bold whitespace-nowrap hover:bg-emerald-700 transition-colors"
                            >
                              호스트 배정
                            </button>
                          )}
                          <button
                            onClick={() => setCancelTarget(b)}
                            className="px-2 py-1 md:px-3 md:py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-[9px] md:text-[10px] font-bold whitespace-nowrap hover:bg-red-100 transition-colors"
                          >
                            취소
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-[11px] md:text-sm text-slate-400">
                    {allFilter === 'CANCEL_REQ' ? '취소 요청 건이 없습니다.' : '등록된 맞춤 의뢰가 없습니다.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {ConfirmDialogElement}
    </div>
  );
}

// ── 서브탭 2: 정산 대기 ─────────────────────────────────────────────────────
function SettlementTab({ bookings, onRefresh }: { bookings: AdminServiceBooking[]; onRefresh: () => void }) {
  const { showToast } = useToast();
  const { requestConfirm, ConfirmDialogElement } = useConfirmDialog();
  const [expandedHost, setExpandedHost] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const getPayableAmount = (booking: AdminServiceBooking) => booking.status === 'cancelled'
    ? (booking.host_compensation_amount ?? 0)
    : (booking.host_payout_amount ?? 0);

  // 정상 완료 보수와 취소 시 호스트 보상을 하나의 이체 대기열로 관리
  const pendingBookings = bookings.filter(
    b =>
      ['completed', 'cancelled'].includes(b.status) &&
      b.payout_status === 'pending' &&
      b.host_id !== null &&
      getPayableAmount(b) > 0
  );

  // Group by host_id
  const grouped = new Map<string, { hostId: string; hostName: string; bank: string; accountNumber: string; accountHolder: string; items: AdminServiceBooking[]; totalPayout: number }>();
  pendingBookings.forEach(b => {
    const hostId = b.host_id!;
    const appName = b.host_application?.name || b.host_profile?.full_name || '알 수 없음';
    const bankName = b.host_application?.bank_name || '';
    const accountNum = b.host_application?.account_number || '';
    const holder = b.host_application?.account_holder || '-';
    const payout = getPayableAmount(b);

    if (!grouped.has(hostId)) {
      grouped.set(hostId, {
        hostId,
        hostName: appName,
        bank: bankName || '계좌 미등록',
        accountNumber: accountNum,
        accountHolder: holder,
        items: [],
        totalPayout: 0,
      });
    }
    const g = grouped.get(hostId)!;
    g.items.push(b);
    g.totalPayout += payout;
  });

  const groups = Array.from(grouped.values());
  const totalWaiting = groups.reduce((s, g) => s + g.totalPayout, 0);

  const handleDownloadSettlementCSV = (group: typeof groups[0]) => {
    const headers = ['의뢰명', '서비스 날짜', '결제 상태', '결제액', '호스트 지급액'];
    const rows = group.items.map(item => [
      `"${item.service_request?.title || '-'}"`,
      item.service_request?.service_date || format(new Date(item.created_at), 'yyyy-MM-dd'),
      BOOKING_STATUS_LABELS[item.status]?.label || item.status,
      item.amount,
      getPayableAmount(item),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `service_settlement_${group.hostName}_${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const markAsPaid = (bookingIds: string[]) => {
    requestConfirm({
      title: '정산 완료 처리',
      description: `총 ${bookingIds.length}건 이체를 완료하셨습니까?\n확인 시 '정산 완료' 처리됩니다.`,
      confirmLabel: '정산 완료',
      tone: 'default',
    }, async () => {
      setIsProcessing(true);
      try {
        const response = await fetch('/api/admin/service-payouts/mark-paid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingIds }),
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || '정산 완료 처리에 실패했습니다.');
        }

        showToast('정산 완료 처리되었습니다.', 'success');
        onRefresh();
      } catch (err: unknown) {
        showToast('처리 오류: ' + (err instanceof Error ? err.message : ''), 'error');
      } finally {
        setIsProcessing(false);
      }
    });
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Summary header */}
      <div className="bg-white rounded-xl md:rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h3 className="text-[13px] md:text-base font-black text-slate-900 flex items-center gap-2">
            <DollarSign size={16} className="text-emerald-600 md:w-5 md:h-5" /> 서비스 정산 대기
          </h3>
          <p className="text-[10px] md:text-sm text-slate-500 mt-0.5">서비스 완료 보수와 취소 시 확정한 호스트 보상을 이체 완료 처리합니다.</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase mb-0.5">총 지급 대기액</p>
          <p className="text-xl md:text-3xl font-black text-slate-900">₩{totalWaiting.toLocaleString()}</p>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="bg-white rounded-xl md:rounded-2xl border border-slate-100 p-12 text-center">
          <CheckCircle size={40} className="text-emerald-200 mx-auto mb-3" />
          <p className="text-[12px] md:text-sm font-medium text-slate-400">모든 서비스 정산이 완료되었습니다!</p>
        </div>
      ) : (
        groups.map(group => (
          <div key={group.hostId} className="bg-white rounded-xl md:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Host header row */}
            <div
              className="p-4 md:p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setExpandedHost(expandedHost === group.hostId ? null : group.hostId)}
            >
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-sm md:text-base">
                  {group.hostName.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-[13px] md:text-base text-slate-900">{group.hostName}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {group.bank === '계좌 미등록' ? (
                      <span className="flex items-center gap-1 text-red-500 font-bold text-[10px] md:text-xs bg-red-50 px-2 py-0.5 rounded">
                        <AlertTriangle size={10} /> 계좌 미등록
                      </span>
                    ) : (
                      <span className="text-[10px] md:text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {group.bank} {group.accountNumber}
                      </span>
                    )}
                    <span className="text-[10px] md:text-xs text-slate-400">예금주: {group.accountHolder}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 md:gap-5">
                <div className="text-right">
                  <p className="text-[10px] md:text-xs text-slate-400 font-bold mb-0.5">지급액</p>
                  <p className="font-black text-emerald-600 text-base md:text-xl">₩{group.totalPayout.toLocaleString()}</p>
                </div>
                {expandedHost === group.hostId ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
              </div>
            </div>

            {/* Accordion detail */}
            {expandedHost === group.hostId && (
              <div className="border-t border-slate-100 bg-slate-50/50 p-4 md:p-5">
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] md:text-xs text-left min-w-[400px] mb-4">
                    <thead className="text-slate-400 uppercase font-bold border-b border-slate-200">
                      <tr>
                        <th className="pb-2 pl-1">의뢰</th>
                        <th className="pb-2">날짜</th>
                        <th className="pb-2">결제 상태</th>
                        <th className="pb-2 text-right">결제액</th>
                        <th className="pb-2 text-right pr-1">지급액</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.items.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="py-2 pl-1 font-medium text-slate-700 line-clamp-1">{item.service_request?.title || '-'}</td>
                          <td className="py-2 text-slate-500">{item.service_request?.service_date || format(new Date(item.created_at), 'yy.MM.dd')}</td>
                          <td className="py-2">{statusBadge(item.status, BOOKING_STATUS_LABELS)}</td>
                          <td className="py-2 text-right text-slate-400">₩{item.amount.toLocaleString()}</td>
                          <td className="py-2 text-right font-bold text-slate-900 pr-1">
                            ₩{getPayableAmount(item).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-200">
                  <button
                    onClick={() => handleDownloadSettlementCSV(group)}
                    className="px-4 py-2.5 md:px-5 md:py-3 rounded-xl font-bold text-[12px] md:text-sm flex items-center gap-2 border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <Download size={14} /> 명세서 CSV
                  </button>
                  <button
                    onClick={() => markAsPaid(group.items.map(i => i.id))}
                    disabled={isProcessing || group.bank === '계좌 미등록'}
                    className={`px-5 py-2.5 md:px-6 md:py-3 rounded-xl font-bold text-[12px] md:text-sm flex items-center gap-2 shadow-sm transition-all ${
                      group.bank === '계좌 미등록'
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-900 text-white hover:bg-black hover:scale-[1.02]'
                    } disabled:opacity-60`}
                  >
                    <CheckCircle size={14} />
                    {group.bank === '계좌 미등록' ? '계좌 정보 없음' : '이체 완료 처리'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
      {ConfirmDialogElement}
    </div>
  );
}

// ── 서브탭 3: 취소·환불 내역 ─────────────────────────────────────────────────
function RefundHistoryTab({ bookings }: { bookings: AdminServiceBooking[] }) {
  const cancelled = bookings.filter(b => b.status === 'cancelled');

  return (
    <div className="bg-white rounded-xl md:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs md:text-sm text-left min-w-[600px]">
          <thead className="bg-slate-50 text-slate-500 text-[10px] md:text-xs uppercase border-b border-slate-100">
            <tr>
              <th className="px-4 py-3">주문번호</th>
              <th className="px-4 py-3">의뢰</th>
              <th className="px-4 py-3">고객</th>
              <th className="px-4 py-3">주문일</th>
              <th className="px-4 py-3">결제액</th>
              <th className="px-4 py-3">환불액</th>
              <th className="px-4 py-3">취소 사유</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {cancelled.length > 0 ? cancelled.map(b => (
              <tr key={b.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-[10px] md:text-xs text-slate-400">
                  {b.order_id ? b.order_id.slice(-12) : b.id.slice(-8)}
                </td>
                <td className="px-4 py-3 text-[11px] md:text-sm text-slate-700 line-clamp-1 max-w-[180px]">
                  {b.service_request?.title || '-'}
                </td>
                <td className="px-4 py-3 text-[10px] md:text-xs text-slate-500">
                  {b.customer_profile?.full_name || b.customer_id.slice(-6)}
                </td>
                <td className="px-4 py-3 text-[10px] md:text-xs text-slate-400">
                  {format(new Date(b.created_at), 'yy.MM.dd')}
                </td>
                <td className="px-4 py-3 text-[11px] md:text-sm text-slate-500">₩{b.amount.toLocaleString()}</td>
                <td className="px-4 py-3 font-bold text-[11px] md:text-sm text-red-600">
                  {b.refund_amount != null ? `₩${b.refund_amount.toLocaleString()}` : '-'}
                </td>
                <td className="px-4 py-3 text-[10px] md:text-xs text-slate-400 line-clamp-1 max-w-[160px]">
                  {b.cancel_reason || '-'}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[11px] md:text-sm text-slate-400">
                  취소·환불 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 메인 탭 컴포넌트 ────────────────────────────────────────────────────────
type ServiceSubTab = 'ALL' | 'SETTLEMENT' | 'REFUND';

export default function ServiceAdminTab() {
  const { bookings, isLoading, refresh } = useServiceAdminData();
  const [subTab, setSubTab] = useState<ServiceSubTab>('ALL');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={32} className="animate-spin text-slate-400" />
      </div>
    );
  }

  const SUB_TABS: { key: ServiceSubTab; label: string }[] = [
    { key: 'ALL', label: '전체 의뢰' },
    { key: 'SETTLEMENT', label: '정산 대기' },
    { key: 'REFUND', label: '취소·환불 내역' },
  ];

  // KPI counts
  const totalPaid = bookings.filter(b => ['PAID', 'confirmed', 'completed'].includes(b.status)).reduce((s, b) => s + b.amount, 0);
  const pendingSettlement = bookings.filter(b => b.status === 'completed' && b.payout_status === 'pending' && b.host_id).length;
  const cancelledCount = bookings.filter(b => b.status === 'cancelled').length;
  const cancellationRequestedCount = bookings.filter(b => b.status === 'cancellation_requested').length;
  const totalHostPayout = bookings.filter(b => ['PAID', 'confirmed', 'completed'].includes(b.status)).reduce((s, b) => s + (b.host_payout_amount ?? 0), 0);
  const totalPlatformRevenue = bookings.filter(b => ['PAID', 'confirmed', 'completed'].includes(b.status)).reduce((s, b) => s + (b.platform_revenue ?? 0), 0);

  return (
    <div className="flex-1 space-y-4 md:space-y-6 overflow-y-auto p-1 md:p-2 animate-in fade-in zoom-in-95 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Briefcase className="text-slate-700 w-5 h-5 md:w-6 md:h-6" /> 맞춤 의뢰 관리
          </h2>
          <p className="text-[10px] md:text-sm text-slate-500 mt-0.5">역경매 서비스 매칭 결제 흐름 및 호스트 정산을 통제합니다.</p>
        </div>
        <button onClick={refresh} className="flex items-center gap-1.5 px-3 py-2 text-[11px] md:text-sm font-medium border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors">
          <RefreshCcw size={14} /> 새로고침
        </button>
      </div>

      {/* KPI mini cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        <div className="bg-white rounded-xl border border-slate-100 p-3 md:p-4 shadow-sm">
          <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase mb-1">총 결제액 (GMV)</p>
          <p className="text-[15px] md:text-2xl font-black text-slate-900">₩{totalPaid.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-3 md:p-4 shadow-sm">
          <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase mb-1">호스트 지급액</p>
          <p className="text-[15px] md:text-2xl font-black text-emerald-600">₩{totalHostPayout.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-3 md:p-4 shadow-sm">
          <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase mb-1">순수익</p>
          <p className="text-[15px] md:text-2xl font-black text-blue-600">₩{totalPlatformRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-3 md:p-4 shadow-sm">
          <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase mb-1">정산 대기 건수</p>
          <p className="text-[15px] md:text-2xl font-black text-amber-600">{pendingSettlement}건</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-3 md:p-4 shadow-sm">
          <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase mb-1">취소 건수</p>
          <p className="text-[15px] md:text-2xl font-black text-red-600">{cancelledCount}건</p>
        </div>
        <div className={`rounded-xl border p-3 md:p-4 shadow-sm ${cancellationRequestedCount > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-100'}`}>
          <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase mb-1">취소 요청 검토</p>
          <p className={`text-[15px] md:text-2xl font-black ${cancellationRequestedCount > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
            {cancellationRequestedCount}건
          </p>
        </div>
      </div>

      {/* Sub-tab selector */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {SUB_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-[11px] md:text-sm font-bold transition-all ${
              subTab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {subTab === 'ALL' && <AllRequestsTab bookings={bookings} onRefresh={refresh} />}
      {subTab === 'SETTLEMENT' && <SettlementTab bookings={bookings} onRefresh={refresh} />}
      {subTab === 'REFUND' && <RefundHistoryTab bookings={bookings} />}
    </div>
  );
}
