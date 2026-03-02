'use client';

import React, { useState } from 'react';
import {
  Briefcase, DollarSign, RefreshCcw, CheckCircle, AlertTriangle, ChevronDown, ChevronUp,
  X, Loader2, Download
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/app/context/ToastContext';
import { createClient } from '@/app/utils/supabase/client';
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
  open: '호스트 모집 중',
  matched: '매칭 완료',
  confirmed: '확정',
  completed: '완료',
  cancelled: '취소',
  expired: '만료',
};

function statusBadge(status: string, map: Record<string, { label: string; cls: string }>) {
  const cfg = map[status] ?? { label: status, cls: 'bg-slate-50 text-slate-500' };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] md:text-[11px] font-bold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ── 강제 취소 모달 ──────────────────────────────────────────────────────────
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
  const isFullRefund = booking.status === 'PAID' && (booking.service_request?.status === 'open' || booking.service_request?.status === 'pending_payment');
  const [refundAmt, setRefundAmt] = useState(booking.amount);
  const [reason, setReason] = useState('관리자 강제 취소');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async () => {
    if (!confirm(`₩${refundAmt.toLocaleString()} 환불로 강제 취소하시겠습니까?`)) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/admin/service-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: booking.order_id, refund_amount: refundAmt, cancel_reason: reason }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
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
    </div>
  );
}

// ── 서브탭 1: 전체 의뢰 목록 ────────────────────────────────────────────────
type AllFilter = 'ALL' | 'CANCEL_REQ';

function AllRequestsTab({ bookings, onRefresh }: { bookings: AdminServiceBooking[]; onRefresh: () => void }) {
  const { showToast } = useToast();
  const [cancelTarget, setCancelTarget] = useState<AdminServiceBooking | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [allFilter, setAllFilter] = useState<AllFilter>('ALL');

  const cancelReqCount = bookings.filter(b => b.status === 'cancellation_requested').length;
  const displayedBookings = allFilter === 'CANCEL_REQ'
    ? bookings.filter(b => b.status === 'cancellation_requested')
    : bookings;

  const handleConfirmPayment = async (orderId: string) => {
    if (!confirm('입금이 확인되었습니까? 의뢰를 공개하고 호스트 모집을 시작합니다.')) return;
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
      showToast('입금 확인 완료. 의뢰가 공개되었습니다.', 'success');
      onRefresh();
    } catch {
      showToast('서버 오류가 발생했습니다.', 'error');
    } finally {
      setIsProcessing(false);
    }
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
                <th className="px-4 py-3">결제수단</th>
                <th className="px-4 py-3">의뢰 상태</th>
                <th className="px-4 py-3">결제 상태</th>
                <th className="px-4 py-3">정산</th>
                <th className="px-4 py-3">등록일</th>
                <th className="px-4 py-3 text-right">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayedBookings.length > 0 ? displayedBookings.map(b => (
                <tr key={b.id} className={`hover:bg-slate-50 transition-colors ${b.status === 'cancellation_requested' ? 'bg-orange-50/40' : ''}`}>
                  <td className="px-4 py-3 font-mono text-slate-400 text-[10px] md:text-xs">
                    {b.order_id ? b.order_id.slice(-12) : b.id.slice(-8)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-[11px] md:text-sm text-slate-900 line-clamp-1">{b.service_request?.title || '-'}</p>
                    <p className="text-[10px] md:text-xs text-slate-400">{b.service_request?.city} · {b.service_request?.service_date} · {b.service_request?.duration_hours}h</p>
                  </td>
                  <td className="px-4 py-3 text-[10px] md:text-xs text-slate-600">
                    {b.customer_profile?.full_name || b.customer_profile?.email || b.customer_id.slice(-6)}
                  </td>
                  <td className="px-4 py-3 font-bold text-[11px] md:text-sm text-slate-900">₩{b.amount.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {b.payment_method === 'bank' ? (
                      <span className="text-[10px] md:text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold">🏛️ 무통장</span>
                    ) : (
                      <span className="text-[10px] md:text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">💳 카드</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] md:text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                      {REQUEST_STATUS_LABELS[b.service_request?.status ?? ''] ?? (b.service_request?.status ?? '-')}
                    </span>
                  </td>
                  <td className="px-4 py-3">{statusBadge(b.status, BOOKING_STATUS_LABELS)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] md:text-xs px-2 py-0.5 rounded font-bold ${b.payout_status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-yellow-50 text-yellow-700'}`}>
                      {b.payout_status === 'paid' ? '정산완료' : (b.host_id ? '정산대기' : '미선택')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[10px] md:text-xs text-slate-400">
                    {format(new Date(b.created_at), 'yy.MM.dd')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {b.status === 'cancelled' || b.service_request?.status === 'completed' ? (
                      <span className="text-[10px] md:text-xs text-slate-300 font-medium">불가</span>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        {b.status === 'PENDING' && b.payment_method === 'bank' && (
                          <button
                            onClick={() => handleConfirmPayment(b.order_id)}
                            disabled={isProcessing}
                            className="px-2 py-1 md:px-3 md:py-1.5 bg-blue-600 text-white border border-blue-700 rounded-lg text-[10px] md:text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-60"
                          >
                            💰 입금 확인
                          </button>
                        )}
                        <button
                          onClick={() => setCancelTarget(b)}
                          className="px-2 py-1 md:px-3 md:py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-[10px] md:text-xs font-bold hover:bg-red-100 transition-colors"
                        >
                          강제 취소
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-[11px] md:text-sm text-slate-400">
                    {allFilter === 'CANCEL_REQ' ? '취소 요청 건이 없습니다.' : '등록된 맞춤 의뢰가 없습니다.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── 서브탭 2: 정산 대기 ─────────────────────────────────────────────────────
function SettlementTab({ bookings, onRefresh }: { bookings: AdminServiceBooking[]; onRefresh: () => void }) {
  const { showToast } = useToast();
  const supabase = createClient();
  const [expandedHost, setExpandedHost] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter: PAID/confirmed/completed + payout=pending + host selected
  const pendingBookings = bookings.filter(
    b =>
      ['PAID', 'confirmed', 'completed'].includes(b.status) &&
      b.payout_status === 'pending' &&
      b.host_id !== null
  );

  // Group by host_id
  const grouped = new Map<string, { hostId: string; hostName: string; bank: string; accountNumber: string; accountHolder: string; items: AdminServiceBooking[]; totalPayout: number }>();
  pendingBookings.forEach(b => {
    const hostId = b.host_id!;
    const appName = b.host_application?.name || b.host_profile?.full_name || '알 수 없음';
    const bankName = b.host_application?.bank_name || '';
    const accountNum = b.host_application?.account_number || '';
    const holder = b.host_application?.account_holder || '-';
    const payout = b.host_payout_amount ?? 0;

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
      item.host_payout_amount ?? 0,
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

  const markAsPaid = async (hostId: string, bookingIds: string[]) => {
    if (!confirm(`총 ${bookingIds.length}건 이체를 완료하셨습니까?\n확인 시 '정산 완료' 처리됩니다.`)) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('service_bookings')
        .update({ payout_status: 'paid' })
        .in('id', bookingIds);

      if (error) throw error;
      showToast('정산 완료 처리되었습니다.', 'success');
      onRefresh();
    } catch (err: any) {
      showToast('처리 오류: ' + (err.message || ''), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Summary header */}
      <div className="bg-white rounded-xl md:rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h3 className="text-[13px] md:text-base font-black text-slate-900 flex items-center gap-2">
            <DollarSign size={16} className="text-emerald-600 md:w-5 md:h-5" /> 서비스 정산 대기
          </h3>
          <p className="text-[10px] md:text-sm text-slate-500 mt-0.5">호스트에게 이체 후 "이체 완료 처리" 버튼을 누르세요.</p>
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
                            ₩{(item.host_payout_amount ?? 0).toLocaleString()}
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
                    onClick={() => markAsPaid(group.hostId, group.items.map(i => i.id))}
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
              <th className="px-4 py-3">취소일</th>
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
  const pendingSettlement = bookings.filter(b => ['PAID', 'confirmed', 'completed'].includes(b.status) && b.payout_status === 'pending' && b.host_id).length;
  const cancelledCount = bookings.filter(b => b.status === 'cancelled').length;
  const cancellationRequestedCount = bookings.filter(b => b.status === 'cancellation_requested').length;

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white rounded-xl border border-slate-100 p-3 md:p-4 shadow-sm">
          <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase mb-1">총 결제액 (GMV)</p>
          <p className="text-[15px] md:text-2xl font-black text-slate-900">₩{totalPaid.toLocaleString()}</p>
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
