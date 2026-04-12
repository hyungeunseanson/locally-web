'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import { AlertCircle, CheckCircle, Clock, ExternalLink, Phone, Send, XCircle } from 'lucide-react';

import type { PaymentStatus, ProxyComment, ProxyRequest, ProxyStatus } from '@/app/types/proxy';
import {
  getProxyCategoryLabel,
  getProxyFormDisplayEntries,
  getProxyLinkedInquiryId,
  getProxyPaymentMethod,
  getProxyRequestFeeKrw,
  getProxyRequestTitle,
  getProxyRequesterDisplayName,
} from '@/app/utils/proxyBooking';

type ProxyRequestDetail = ProxyRequest & {
  comments?: ProxyComment[];
};

type ProxyListResponse = {
  success?: boolean;
  data?: ProxyRequest[];
};

type ProxyDetailResponse = {
  success?: boolean;
  data?: ProxyRequestDetail;
};

type PhoneReservationTabProps = {
  initialSelectedRequestId?: string | null;
};

function getStatusBadge(status: string) {
  switch (status) {
    case 'PENDING':
      return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold flex items-center gap-1"><Clock size={12} /> 대기 중</span>;
    case 'IN_PROGRESS':
      return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold flex items-center gap-1"><Phone size={12} /> 진행 중</span>;
    case 'COMPLETED':
      return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold flex items-center gap-1"><CheckCircle size={12} /> 완료</span>;
    case 'CANCELLED':
      return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold flex items-center gap-1"><XCircle size={12} /> 취소됨</span>;
    default:
      return <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">{status}</span>;
  }
}

function getPaymentStatusLabel(status: PaymentStatus) {
  switch (status) {
    case 'COMPLETED':
      return '결제 완료';
    case 'FAILED':
      return '결제 취소';
    case 'REFUNDED':
      return '환불 완료';
    default:
      return '결제 대기';
  }
}

function getProxyNextActionCopy(request: ProxyRequest) {
  const paymentMethod = getProxyPaymentMethod(request.form_data);

  if (request.payment_status === 'WAITING' && (request.payment_channel === 'NAVER' || paymentMethod === 'bank')) {
    return {
      text: '입금 확인 또는 결제 취소를 먼저 처리해야 실제 전화 진행을 시작할 수 있습니다.',
      cls: 'text-amber-600',
    };
  }

  if (request.payment_status === 'WAITING' && paymentMethod === 'card') {
    return {
      text: '카드 결제 완료를 기다리는 상태입니다. 완료 후 진행 중으로 바꿀 수 있습니다.',
      cls: 'text-blue-600',
    };
  }

  if (request.payment_status === 'COMPLETED' && request.status === 'PENDING') {
    return {
      text: '결제가 완료되었습니다. 전화 진행을 시작하거나 댓글로 진행 상황을 바로 안내해주세요.',
      cls: 'text-emerald-600',
    };
  }

  if (request.payment_status === 'COMPLETED' && request.status === 'IN_PROGRESS') {
    return {
      text: '고객에게 최신 진행 상황을 댓글로 남기고, 끝나면 완료 처리해주세요.',
      cls: 'text-indigo-600',
    };
  }

  if (request.payment_status === 'COMPLETED' && request.status === 'COMPLETED') {
    return {
      text: '전화 예약이 끝난 상태입니다. 필요하면 환불 처리 여부만 다시 확인해주세요.',
      cls: 'text-slate-500',
    };
  }

  if (request.payment_status === 'REFUNDED') {
    return {
      text: '환불이 끝났습니다. 고객 안내가 부족했다면 댓글이나 메시지함 기록도 함께 확인해주세요.',
      cls: 'text-rose-600',
    };
  }

  if (request.status === 'CANCELLED' || request.payment_status === 'FAILED') {
    return {
      text: '취소된 요청입니다. 필요하면 취소 사유와 댓글 기록을 다시 확인해주세요.',
      cls: 'text-slate-400',
    };
  }

  return {
    text: '현재 결제 상태와 진행 상태를 함께 확인해주세요.',
    cls: 'text-slate-400',
  };
}

export default function PhoneReservationTab({ initialSelectedRequestId = null }: PhoneReservationTabProps) {
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const selectedRequestRef = useRef<ProxyRequestDetail | null>(null);

  const [requests, setRequests] = useState<ProxyRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ProxyRequestDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [reply, setReply] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [updating, setUpdating] = useState(false);

  const fetchRequests = useCallback(async () => {
    const response = await fetch('/api/proxy-bookings', { cache: 'no-store' });
    const result = (await response.json()) as ProxyListResponse;

    if (!response.ok || result.success === false) {
      throw new Error('전화 예약 목록을 불러오지 못했습니다.');
    }

    const nextRequests = Array.isArray(result.data) ? result.data : [];
    setRequests(nextRequests);
    return nextRequests;
  }, []);

  const loadDetail = useCallback(async (requestId: string) => {
    setLoadingDetail(true);
    try {
      const response = await fetch(`/api/proxy-bookings/${requestId}`, { cache: 'no-store' });
      const result = (await response.json()) as ProxyDetailResponse;

      if (!response.ok || result.success === false || !result.data) {
        throw new Error('전화 예약 상세를 불러오지 못했습니다.');
      }

      setSelectedRequest(result.data);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    selectedRequestRef.current = selectedRequest;
  }, [selectedRequest]);

  const refreshSelectedRequest = useCallback(async (requestId?: string | null) => {
    const nextRequests = await fetchRequests();
    const preferredId = requestId || selectedIdRef.current || initialSelectedRequestId;

    if (preferredId && nextRequests.some((item) => item.id === preferredId)) {
      setSelectedId(preferredId);
      await loadDetail(preferredId);
      return nextRequests;
    }

    if (nextRequests[0]?.id) {
      setSelectedId(nextRequests[0].id);
      await loadDetail(nextRequests[0].id);
    } else {
      setSelectedId(null);
      setSelectedRequest(null);
    }

    return nextRequests;
  }, [fetchRequests, initialSelectedRequestId, loadDetail]);

  const scheduleRefresh = useCallback((requestId?: string | null) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = setTimeout(async () => {
      try {
        await refreshSelectedRequest(requestId);
      } catch (error) {
        console.error('[PhoneReservationTab] refresh failed:', error);
      }
    }, 200);
  }, [refreshSelectedRequest]);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        await refreshSelectedRequest(initialSelectedRequestId);
        if (!isMounted) return;
      } catch (error) {
        console.error('[PhoneReservationTab] init failed:', error);
        if (isMounted) {
          showToast('전화 예약 목록을 불러오지 못했습니다.', 'error');
        }
      } finally {
        if (isMounted) {
          setLoadingList(false);
        }
      }

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      channelRef.current = supabase
        .channel('team-phone-reservations')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'proxy_requests' }, () => {
          scheduleRefresh();
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inquiry_messages' }, (payload) => {
          const linkedInquiryId = getProxyLinkedInquiryId(selectedRequestRef.current?.form_data);
          const payloadInquiryId = payload.new?.inquiry_id != null ? String(payload.new.inquiry_id) : null;
          if (linkedInquiryId && payloadInquiryId && linkedInquiryId === payloadInquiryId) {
            scheduleRefresh(selectedIdRef.current);
          }
        })
        .subscribe();
    };

    init();

    return () => {
      isMounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [initialSelectedRequestId, refreshSelectedRequest, scheduleRefresh, showToast, supabase]);

  useEffect(() => {
    if (initialSelectedRequestId && requests.some((item) => item.id === initialSelectedRequestId)) {
      setSelectedId(initialSelectedRequestId);
    }
  }, [initialSelectedRequestId, requests]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedRequest(null);
      return;
    }

    loadDetail(selectedId).catch((error) => {
      console.error('[PhoneReservationTab] load detail failed:', error);
      showToast('전화 예약 상세를 불러오지 못했습니다.', 'error');
    });
  }, [loadDetail, selectedId, showToast]);

  const handleUpdateStatus = useCallback(async (nextStatus: ProxyStatus) => {
    if (!selectedId) return;

    setUpdating(true);
    try {
      const response = await fetch(`/api/proxy-bookings/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || '상태 변경에 실패했습니다.');
      }

      await refreshSelectedRequest(selectedId);
      showToast('전화 예약 상태를 업데이트했습니다.', 'success');
    } catch (error) {
      console.error('[PhoneReservationTab] update status failed:', error);
      showToast(error instanceof Error ? error.message : '상태 변경에 실패했습니다.', 'error');
    } finally {
      setUpdating(false);
    }
  }, [refreshSelectedRequest, selectedId, showToast]);

  const applyLocalPaymentState = useCallback((
    requestId: string,
    nextPaymentStatus: PaymentStatus,
    nextRequestStatus?: ProxyStatus
  ) => {
    setRequests((prev) => prev.map((item) => (
      item.id === requestId
        ? {
            ...item,
            payment_status: nextPaymentStatus,
            ...(nextRequestStatus ? { status: nextRequestStatus } : {}),
          }
        : item
    )));

    setSelectedRequest((prev) => (
      prev && prev.id === requestId
        ? {
            ...prev,
            payment_status: nextPaymentStatus,
            ...(nextRequestStatus ? { status: nextRequestStatus } : {}),
          }
        : prev
    ));
  }, []);

  const handlePaymentAction = useCallback(async (
    endpoint: '/api/admin/proxy-bookings/confirm-payment' | '/api/admin/proxy-bookings/cancel-payment' | '/api/admin/proxy-bookings/refund-payment',
    successMessage: string
  ) => {
    if (!selectedId) return;

    setUpdating(true);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: selectedId }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || '결제 상태 변경에 실패했습니다.');
      }

      if (endpoint === '/api/admin/proxy-bookings/confirm-payment') {
        applyLocalPaymentState(selectedId, 'COMPLETED');
      } else if (endpoint === '/api/admin/proxy-bookings/cancel-payment') {
        applyLocalPaymentState(selectedId, 'FAILED', 'CANCELLED');
      } else {
        applyLocalPaymentState(selectedId, 'REFUNDED');
      }

      void refreshSelectedRequest(selectedId).catch((error) => {
        console.error('[PhoneReservationTab] refresh after payment action failed:', error);
      });
      showToast(successMessage, 'success');
    } catch (error) {
      console.error('[PhoneReservationTab] update payment failed:', error);
      showToast(error instanceof Error ? error.message : '결제 상태 변경에 실패했습니다.', 'error');
    } finally {
      setUpdating(false);
    }
  }, [applyLocalPaymentState, refreshSelectedRequest, selectedId, showToast]);

  const handleSubmitReply = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedId || !reply.trim() || submittingReply) return;

    setSubmittingReply(true);
    try {
      const response = await fetch(`/api/proxy-bookings/${selectedId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: reply.trim() }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || result?.success === false || !result?.data) {
        throw new Error(result?.error || '답글 전송에 실패했습니다.');
      }

      setSelectedRequest((prev) => (
        prev
          ? {
              ...prev,
              comments: [...(prev.comments || []), result.data as ProxyComment],
            }
          : prev
      ));
      setReply('');
      showToast('고객에게 답글을 보냈습니다.', 'success');
    } catch (error) {
      console.error('[PhoneReservationTab] submit reply failed:', error);
      showToast(error instanceof Error ? error.message : '답글 전송에 실패했습니다.', 'error');
    } finally {
      setSubmittingReply(false);
    }
  }, [reply, selectedId, showToast, submittingReply]);

  const selectedServiceFee = selectedRequest
    ? getProxyRequestFeeKrw(selectedRequest.category, selectedRequest.form_data)
    : null;
  const linkedInquiryId = selectedRequest
    ? getProxyLinkedInquiryId(selectedRequest.form_data)
    : null;
  const selectedFormEntries = selectedRequest
    ? getProxyFormDisplayEntries(selectedRequest.form_data)
    : [];
  const selectedPaymentMethod = selectedRequest
    ? getProxyPaymentMethod(selectedRequest.form_data)
    : null;
  const canStartProcessing = selectedRequest?.payment_status === 'COMPLETED';
  const showManualPaymentActions = Boolean(
    selectedRequest &&
    selectedRequest.payment_status === 'WAITING' &&
    (selectedRequest.payment_channel === 'NAVER' || selectedPaymentMethod === 'bank')
  );
  const showCardWaitingHint = Boolean(
    selectedRequest &&
    selectedRequest.payment_status === 'WAITING' &&
    selectedPaymentMethod === 'card'
  );
  const showRefundAction = Boolean(selectedRequest && selectedRequest.payment_status === 'COMPLETED');
  const manualPaymentWaitingCount = requests.filter((item) => {
    const paymentMethod = getProxyPaymentMethod(item.form_data);
    return item.payment_status === 'WAITING' && (item.payment_channel === 'NAVER' || paymentMethod === 'bank');
  }).length;
  const cardWaitingCount = requests.filter((item) => getProxyPaymentMethod(item.form_data) === 'card' && item.payment_status === 'WAITING').length;
  const inProgressCount = requests.filter((item) => item.status === 'IN_PROGRESS').length;
  const refundableCount = requests.filter((item) => item.payment_status === 'COMPLETED').length;

  if (loadingList) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4 md:gap-6 h-full">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div className="h-8 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-48 bg-slate-100 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4 md:gap-6 flex-1 min-h-0">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[320px]">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <h3 className="text-sm font-bold text-slate-900">전화 예약</h3>
            <p className="text-xs text-slate-500">새 요청과 진행 상태를 한 곳에서 확인합니다.</p>
          </div>
          <span className="text-xs font-semibold text-slate-500">{requests.length}건</span>
        </div>

        <div className="mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle size={15} className="text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-2">
              <div>
                <p className="text-[12px] font-black text-slate-900">운영 빠른 안내</p>
                <p className="text-[11px] leading-relaxed text-slate-600 mt-0.5">
                  무통장·네이버 결제 대기는 먼저 입금 확인을 해야 하고, 카드 결제 대기는 자동 반영을 기다리면 됩니다. 결제 완료 후에는 진행 상태와 댓글 안내를 함께 관리해주세요.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-blue-100 bg-white px-2.5 py-1 text-[10px] font-bold text-blue-700">
                  입금 확인 필요 {manualPaymentWaitingCount}건
                </span>
                <span className="rounded-full border border-indigo-100 bg-white px-2.5 py-1 text-[10px] font-bold text-indigo-700">
                  카드 대기 {cardWaitingCount}건
                </span>
                <span className="rounded-full border border-emerald-100 bg-white px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                  진행 중 {inProgressCount}건
                </span>
                <span className="rounded-full border border-amber-100 bg-white px-2.5 py-1 text-[10px] font-bold text-amber-700">
                  환불 가능 {refundableCount}건
                </span>
              </div>
            </div>
          </div>
        </div>

        {requests.length === 0 ? (
          <div className="px-4 py-10 text-sm text-slate-500 text-center">아직 접수된 전화 예약이 없습니다.</div>
        ) : (
          <div className="mt-4 max-h-[65vh] overflow-y-auto divide-y divide-slate-100">
            {requests.map((item) => {
              const paymentMethod = getProxyPaymentMethod(item.form_data);
              const isSelected = selectedId === item.id;
              const nextActionCopy = getProxyNextActionCopy(item);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full text-left px-4 py-4 transition-colors ${isSelected ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{getProxyCategoryLabel(item.category)}</p>
                      <p className="text-sm font-bold text-slate-900 truncate">{getProxyRequestTitle(item)}</p>
                      <p className="text-xs text-slate-500 mt-1">{getProxyRequesterDisplayName(item.profiles)}</p>
                    </div>
                    <div className="shrink-0">{getStatusBadge(item.status)}</div>
                  </div>
                  <div className="flex items-center justify-between mt-3 text-[11px] text-slate-500">
                    <span>{new Date(item.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    <span>{item.payment_channel}{paymentMethod ? ` · ${paymentMethod === 'card' ? '카드' : '무통장'}` : ''}</span>
                  </div>
                  <p className={`mt-2 text-[11px] font-medium leading-relaxed ${nextActionCopy.cls}`}>
                    {nextActionCopy.text}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[420px] flex flex-col">
        {!selectedRequest ? (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
            확인할 전화 예약을 선택해주세요.
          </div>
        ) : (
          <>
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{getProxyCategoryLabel(selectedRequest.category)}</p>
                  <h3 className="text-lg font-bold text-slate-900">{getProxyRequestTitle(selectedRequest)}</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    고객: {getProxyRequesterDisplayName(selectedRequest.profiles)}
                    {selectedRequest.profiles?.email ? ` · ${selectedRequest.profiles.email}` : ''}
                  </p>
                  {selectedRequest.profiles?.phone && (
                    <p className="text-sm text-slate-500">{selectedRequest.profiles.phone}</p>
                  )}
                </div>
                <div className="shrink-0">{getStatusBadge(selectedRequest.status)}</div>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 space-y-3 text-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h4 className="font-bold text-slate-900">결제 정보</h4>
                  <div className="text-xs font-semibold text-slate-500">
                    현재 결제 상태: <span className="text-slate-900">{getPaymentStatusLabel(selectedRequest.payment_status)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div className="flex justify-between gap-3"><span className="text-slate-500">결제 채널</span><span className="font-semibold">{selectedRequest.payment_channel}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-slate-500">결제 수단</span><span className="font-semibold">{selectedPaymentMethod === 'card' ? '카드' : selectedPaymentMethod === 'bank' ? '무통장' : '미지정'}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-slate-500">서비스 수수료</span><span className="font-semibold">₩{selectedServiceFee?.toLocaleString()}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-slate-500">결제 상태</span><span className="font-semibold">{getPaymentStatusLabel(selectedRequest.payment_status)}</span></div>
                  {selectedRequest.locally_order_id && (
                    <div className="flex justify-between gap-3 md:col-span-2"><span className="text-slate-500">주문번호</span><span className="font-mono text-xs">{selectedRequest.locally_order_id}</span></div>
                  )}
                  {selectedRequest.naver_buyer_name && (
                    <div className="flex justify-between gap-3 md:col-span-2"><span className="text-slate-500">네이버 구매자명</span><span className="font-semibold">{selectedRequest.naver_buyer_name}</span></div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
                <p className="font-bold text-slate-900">운영 판단 메모</p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
                  {selectedRequest.payment_status === 'WAITING' && (selectedRequest.payment_channel === 'NAVER' || selectedPaymentMethod === 'bank')
                    ? '무통장·네이버 결제 대기입니다. 입금 확인 후에만 실제 전화 진행을 시작하고, 취소 시에는 결제 취소부터 처리해주세요.'
                    : selectedRequest.payment_status === 'WAITING' && selectedPaymentMethod === 'card'
                    ? '카드 결제 대기 상태입니다. 결제가 자동 반영되기 전에는 진행 중으로 바꾸지 않는 것이 안전합니다.'
                    : selectedRequest.payment_status === 'COMPLETED'
                    ? '결제는 끝난 상태입니다. 이제 진행 상태를 갱신하고, 댓글로 고객에게 예약 진행 상황을 남겨주는 것이 가장 중요합니다.'
                    : selectedRequest.payment_status === 'REFUNDED'
                    ? '환불이 완료된 상태입니다. 추가 문의가 생기면 댓글 기록과 메시지함 안내를 함께 확인해주세요.'
                    : '현재 결제 상태와 진행 상태를 함께 보고 다음 행동을 결정해주세요.'}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">결제 액션</h4>
                    <p className="text-xs text-slate-500 mt-1">현재 결제 상태에서 가능한 작업만 노출됩니다.</p>
                  </div>
                </div>

                {showManualPaymentActions && (
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => handlePaymentAction('/api/admin/proxy-bookings/confirm-payment', '결제 확인을 완료했습니다.')}
                      className="w-full rounded-xl border border-emerald-200 px-3 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
                    >
                      입금 확인
                    </button>
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => handlePaymentAction('/api/admin/proxy-bookings/cancel-payment', '결제 취소 처리를 완료했습니다.')}
                      className="w-full rounded-xl border border-rose-200 px-3 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                    >
                      결제 취소
                    </button>
                  </div>
                )}

                {showManualPaymentActions && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    입금 확인은 결제 상태만 `완료`로 바꾸고, 이후 실제 전화 진행은 아래 `운영 액션`에서 시작해주세요.
                  </div>
                )}

                {showCardWaitingHint && (
                  <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                    고객 카드 결제 대기 중입니다. 카드 결제 완료 후 자동으로 반영됩니다.
                  </div>
                )}

                {showRefundAction && (
                  <div className="mt-4">
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => handlePaymentAction('/api/admin/proxy-bookings/refund-payment', '환불 처리를 완료했습니다.')}
                      className="w-full rounded-xl border border-amber-200 px-3 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-60"
                    >
                      환불 처리
                    </button>
                  </div>
                )}

                {!showManualPaymentActions && !showCardWaitingHint && !showRefundAction && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    현재 결제 상태에서는 추가 결제 액션이 없습니다.
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">운영 액션</h4>
                    <p className="text-xs text-slate-500 mt-1">결제 완료 후에만 실제 전화 진행을 시작하거나 완료로 변경할 수 있습니다.</p>
                  </div>
                  <div className="text-xs font-semibold text-slate-500">
                    현재 상태: <span className="text-slate-900">{selectedRequest.status === 'PENDING' ? '대기 중' : selectedRequest.status === 'IN_PROGRESS' ? '진행 중' : selectedRequest.status === 'COMPLETED' ? '완료' : '취소'}</span>
                  </div>
                </div>
                {!canStartProcessing && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    결제 완료 후에만 전화 예약 진행을 시작할 수 있습니다.
                  </div>
                )}
                <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
                  <button type="button" disabled={updating} onClick={() => handleUpdateStatus('PENDING')} className="w-full rounded-xl bg-slate-900 px-3 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">대기 중</button>
                  <button type="button" disabled={updating || !canStartProcessing} onClick={() => handleUpdateStatus('IN_PROGRESS')} className="w-full rounded-xl bg-blue-600 px-3 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60">진행 중</button>
                  <button type="button" disabled={updating || !canStartProcessing} onClick={() => handleUpdateStatus('COMPLETED')} className="w-full rounded-xl bg-emerald-600 px-3 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60">완료</button>
                  <button type="button" disabled={updating} onClick={() => handleUpdateStatus('CANCELLED')} className="w-full rounded-xl bg-rose-600 px-3 py-3 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60">취소</button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 p-4">
                <h4 className="font-bold text-slate-900 mb-3">폼 작성 내용</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {selectedFormEntries.map((entry) => (
                    <div key={entry.key} className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{entry.label}</p>
                      <p className="text-slate-800 mt-1 break-words whitespace-pre-wrap">{entry.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle size={16} className="text-slate-500" />
                  <div>
                    <h4 className="font-bold text-slate-900">전화 예약 (담당자 소통 스레드)</h4>
                    <p className="text-xs text-slate-500 mt-1">문의 사항이나 예약 진행 상황에 대해 소통하세요. 여기 답글은 고객이 보는 예약 스레드에도 함께 남습니다.</p>
                  </div>
                </div>

                {linkedInquiryId ? (
                  <a
                    href={`/admin/dashboard?tab=CHATS&inquiryId=${encodeURIComponent(linkedInquiryId)}`}
                    className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <ExternalLink size={14} />
                    1:1 문의함에서 열기
                  </a>
                ) : null}

                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                  {(selectedRequest.comments || []).length === 0 ? (
                    <div className="text-sm text-slate-500 py-6 text-center">아직 댓글이 없습니다.</div>
                  ) : (
                    (selectedRequest.comments || []).map((comment) => (
                      <div key={comment.id} className={`max-w-[90%] ${comment.is_admin ? 'ml-auto' : 'mr-auto'}`}>
                        <div className={`rounded-2xl px-4 py-3 text-sm ${comment.is_admin ? 'bg-slate-900 text-white' : 'bg-slate-50 border border-slate-200 text-slate-800'}`}>
                          <p className={`text-[10px] font-bold mb-1 ${comment.is_admin ? 'text-slate-300' : 'text-slate-400'}`}>
                            {comment.is_admin ? 'Locally 운영팀' : getProxyRequesterDisplayName(comment.profiles)}
                          </p>
                          <p className="whitespace-pre-wrap">{comment.content}</p>
                          <p className={`text-[10px] mt-2 ${comment.is_admin ? 'text-slate-300' : 'text-slate-400'}`}>
                            {new Date(comment.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleSubmitReply} className="mt-4 flex gap-2">
                  <input
                    type="text"
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder="고객에게 보낼 답글을 입력하세요."
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={submittingReply}
                  />
                  <button
                    type="submit"
                    disabled={!reply.trim() || submittingReply}
                    className="shrink-0 rounded-xl bg-black px-4 text-white hover:bg-slate-800 disabled:bg-slate-300"
                  >
                    <Send size={16} />
                  </button>
                </form>
              </div>
            </div>
          </>
        )}

        {loadingDetail && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center rounded-2xl text-sm text-slate-600">
            전화 예약 상세를 불러오는 중입니다.
          </div>
        )}
      </div>
    </div>
  );
}
