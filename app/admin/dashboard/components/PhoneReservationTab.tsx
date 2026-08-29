'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/app/context/ToastContext';
import { CheckCircle, Clock, ExternalLink, Phone, RefreshCw, XCircle } from 'lucide-react';

import type { PaymentStatus, ProxyRequest, ProxyStatus } from '@/app/types/proxy';
import {
  getProxyCategoryLabel,
  getProxyFormDisplayEntries,
  getProxyLinkedInquiryIdFromRequest,
  getProxyPaymentMethod,
  getProxyPaymentStatusLabel,
  getProxyRequestFeeKrw,
  getProxyRequestTitle,
  getProxyRequesterDisplayName,
  compareProxyRequestsForOperations,
} from '@/app/utils/proxyBooking';

type ProxyRequestDetail = ProxyRequest & {
  linked_inquiry_id?: string | null;
};

type ProxyListResponse = {
  success?: boolean;
  data?: ProxyRequest[];
  pagination?: {
    limit?: number;
    offset?: number;
    hasMore?: boolean;
  };
};

type ProxyDetailResponse = {
  success?: boolean;
  data?: ProxyRequestDetail;
};

type PhoneReservationTabProps = {
  initialSelectedRequestId?: string | null;
};

const PAGE_SIZE = 10;
const FORM_PREVIEW_COUNT = 6;

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

function buildProxyRequestsUrl(limit: number, offset: number) {
  const searchParams = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    sort: 'operational',
  });

  return `/api/proxy-bookings?${searchParams.toString()}`;
}

export default function PhoneReservationTab({ initialSelectedRequestId = null }: PhoneReservationTabProps) {
  const { showToast } = useToast();
  const selectedIdRef = useRef<string | null>(null);
  const loadedCountRef = useRef<number>(PAGE_SIZE);

  const [requests, setRequests] = useState<ProxyRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ProxyRequestDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [showAllFormEntries, setShowAllFormEntries] = useState(false);

  const setActiveRequestId = useCallback((requestId: string | null) => {
    selectedIdRef.current = requestId;
    setSelectedId(requestId);
    setShowAllFormEntries(false);
  }, []);

  const fetchRequestsPage = useCallback(async (limit: number, offset: number) => {
    const response = await fetch(buildProxyRequestsUrl(limit, offset), { cache: 'no-store' });
    const result = (await response.json()) as ProxyListResponse;

    if (!response.ok || result.success === false) {
      throw new Error('전화 예약 목록을 불러오지 못했습니다.');
    }

    return {
      data: Array.isArray(result.data) ? result.data : [],
      hasMore: Boolean(result.pagination?.hasMore),
    };
  }, []);

  const loadDetail = useCallback(async (requestId: string) => {
    setLoadingDetail(true);
    try {
      const response = await fetch(`/api/proxy-bookings/${requestId}?includeComments=false`, { cache: 'no-store' });
      const result = (await response.json()) as ProxyDetailResponse;

      if (!response.ok || result.success === false || !result.data) {
        throw new Error('전화 예약 상세를 불러오지 못했습니다.');
      }

      setSelectedRequest(result.data);
      return result.data;
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const selectRequest = useCallback(async (requestId: string) => {
    setActiveRequestId(requestId);

    try {
      await loadDetail(requestId);
    } catch (error) {
      console.error('[PhoneReservationTab] load detail failed:', error);
      showToast('전화 예약 상세를 불러오지 못했습니다.', 'error');
    }
  }, [loadDetail, setActiveRequestId, showToast]);

  const refreshSelectedRequest = useCallback(async (
    requestId?: string | null,
    options?: { loadedCount?: number }
  ) => {
    const requestedLimit = Math.max(options?.loadedCount ?? loadedCountRef.current, PAGE_SIZE);
    const { data: nextRequests, hasMore: nextHasMore } = await fetchRequestsPage(requestedLimit, 0);

    setRequests(nextRequests);
    setHasMore(nextHasMore);
    setNextOffset(nextRequests.length);
    loadedCountRef.current = Math.max(nextRequests.length, PAGE_SIZE);

    const preferredId = requestId ?? selectedIdRef.current;

    if (preferredId) {
      try {
        setActiveRequestId(preferredId);
        await loadDetail(preferredId);
        return nextRequests;
      } catch (error) {
        console.error('[PhoneReservationTab] preferred detail load failed:', error);
      }
    }

    if (nextRequests[0]?.id) {
      setActiveRequestId(nextRequests[0].id);
      await loadDetail(nextRequests[0].id);
    } else {
      setActiveRequestId(null);
      setSelectedRequest(null);
    }

    return nextRequests;
  }, [fetchRequestsPage, loadDetail, setActiveRequestId]);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        await refreshSelectedRequest(initialSelectedRequestId, { loadedCount: PAGE_SIZE });
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
    };

    void init();

    return () => {
      isMounted = false;
    };
  }, [initialSelectedRequestId, refreshSelectedRequest, showToast]);

  useEffect(() => {
    loadedCountRef.current = Math.max(requests.length, PAGE_SIZE);
  }, [requests.length]);

  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshSelectedRequest(undefined, { loadedCount: loadedCountRef.current });
    } catch (error) {
      console.error('[PhoneReservationTab] manual refresh failed:', error);
      showToast('전화 예약 목록을 불러오지 못했습니다.', 'error');
    } finally {
      setRefreshing(false);
    }
  }, [refreshSelectedRequest, showToast]);

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;

    setLoadingMore(true);
    try {
      const { data: nextRequests, hasMore: nextHasMore } = await fetchRequestsPage(PAGE_SIZE, nextOffset);

      setRequests((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        const merged = [...prev];

        for (const item of nextRequests) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            merged.push(item);
          }
        }

        loadedCountRef.current = Math.max(merged.length, PAGE_SIZE);
        return merged;
      });
      setHasMore(nextHasMore);
      setNextOffset((prev) => prev + nextRequests.length);
    } catch (error) {
      console.error('[PhoneReservationTab] load more failed:', error);
      showToast('전화 예약 목록을 더 불러오지 못했습니다.', 'error');
    } finally {
      setLoadingMore(false);
    }
  }, [fetchRequestsPage, hasMore, loadingMore, nextOffset, showToast]);

  const handleUpdateStatus = useCallback(async (nextStatus: ProxyStatus) => {
    if (!selectedIdRef.current) return;

    setUpdating(true);
    try {
      const response = await fetch(`/api/proxy-bookings/${selectedIdRef.current}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || '상태 변경에 실패했습니다.');
      }

      await refreshSelectedRequest(selectedIdRef.current, { loadedCount: loadedCountRef.current });
      showToast('전화 예약 상태를 업데이트했습니다.', 'success');
    } catch (error) {
      console.error('[PhoneReservationTab] update status failed:', error);
      showToast(error instanceof Error ? error.message : '상태 변경에 실패했습니다.', 'error');
    } finally {
      setUpdating(false);
    }
  }, [refreshSelectedRequest, showToast]);

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
    if (!selectedIdRef.current) return;

    setUpdating(true);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: selectedIdRef.current }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || '결제 상태 변경에 실패했습니다.');
      }

      if (endpoint === '/api/admin/proxy-bookings/confirm-payment') {
        applyLocalPaymentState(selectedIdRef.current, 'COMPLETED');
      } else if (endpoint === '/api/admin/proxy-bookings/cancel-payment') {
        applyLocalPaymentState(selectedIdRef.current, 'FAILED', 'CANCELLED');
      } else {
        applyLocalPaymentState(selectedIdRef.current, 'REFUNDED');
      }

      // Keep the operator flow responsive once the write succeeds; the follow-up
      // detail refresh should not block the next valid status action.
      setUpdating(false);
      await refreshSelectedRequest(selectedIdRef.current, { loadedCount: loadedCountRef.current });
      showToast(successMessage, 'success');
    } catch (error) {
      console.error('[PhoneReservationTab] update payment failed:', error);
      showToast(error instanceof Error ? error.message : '결제 상태 변경에 실패했습니다.', 'error');
    } finally {
      setUpdating(false);
    }
  }, [applyLocalPaymentState, refreshSelectedRequest, showToast]);

  const selectedServiceFee = selectedRequest
    ? getProxyRequestFeeKrw(selectedRequest.category, selectedRequest.form_data)
    : null;
  const linkedInquiryId = selectedRequest
    ? getProxyLinkedInquiryIdFromRequest(selectedRequest)
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
  const visibleFormEntries = showAllFormEntries
    ? selectedFormEntries
    : selectedFormEntries.slice(0, FORM_PREVIEW_COUNT);
  const hasExpandableFormEntries = selectedFormEntries.length > FORM_PREVIEW_COUNT;
  const visibleRequests = useMemo(() => {
    const seen = new Set<string>();
    const nextVisibleRequests: ProxyRequest[] = [];

    if (selectedRequest && !requests.some((item) => item.id === selectedRequest.id)) {
      nextVisibleRequests.push(selectedRequest);
      seen.add(selectedRequest.id);
    }

    for (const item of requests) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        nextVisibleRequests.push(item);
      }
    }

    return nextVisibleRequests.sort(compareProxyRequestsForOperations);
  }, [requests, selectedRequest]);

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
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">전화 예약</h3>
              <p className="text-xs text-slate-500">새 요청과 진행 상태를 한 곳에서 확인합니다.</p>
            </div>
            <button
              type="button"
              data-testid="admin-phone-reservation-refresh-button"
              disabled={refreshing || loadingList}
              onClick={() => {
                void handleManualRefresh();
              }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              새로고침
            </button>
          </div>
          <p className="mt-2 text-[11px] font-semibold text-slate-400">{visibleRequests.length}건 표시</p>
        </div>

        {visibleRequests.length === 0 ? (
          <div className="px-4 py-10 text-sm text-slate-500 text-center">아직 접수된 전화 예약이 없습니다.</div>
        ) : (
          <div className="max-h-[72vh] overflow-y-auto" data-testid="admin-phone-reservation-list">
            <div className="divide-y divide-slate-100">
              {visibleRequests.map((item) => {
                const paymentMethod = getProxyPaymentMethod(item.form_data);
                const isSelected = selectedId === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid="admin-phone-reservation-list-item"
                    onClick={() => {
                      if (item.id !== selectedId) {
                        void selectRequest(item.id);
                      }
                    }}
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
                      <span>
                        {paymentMethod === 'card' && item.payment_status === 'WAITING'
                          ? '카드 · 결제 미완료'
                          : `${item.payment_channel}${paymentMethod ? ` · ${paymentMethod === 'card' ? '카드' : '무통장'}` : ''}`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {hasMore && (
              <div className="border-t border-slate-100 p-4">
                <button
                  type="button"
                  data-testid="admin-phone-reservation-load-more-button"
                  disabled={loadingMore}
                  onClick={() => {
                    void handleLoadMore();
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  {loadingMore ? '불러오는 중...' : '더 보기'}
                </button>
              </div>
            )}
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
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
                    {getProxyPaymentStatusLabel(selectedRequest)}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div className="flex justify-between gap-3"><span className="text-slate-500">결제 채널</span><span className="font-semibold">{selectedRequest.payment_channel}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-slate-500">결제 수단</span><span className="font-semibold">{selectedPaymentMethod === 'card' ? '카드' : selectedPaymentMethod === 'bank' ? '무통장' : '미지정'}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-slate-500">서비스 수수료</span><span className="font-semibold">₩{selectedServiceFee?.toLocaleString()}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-slate-500">결제 상태</span><span className="font-semibold">{getProxyPaymentStatusLabel(selectedRequest)}</span></div>
                  {selectedRequest.locally_order_id && (
                    <div className="flex justify-between gap-3 md:col-span-2"><span className="text-slate-500">주문번호</span><span className="font-mono text-xs">{selectedRequest.locally_order_id}</span></div>
                  )}
                  {selectedRequest.naver_buyer_name && (
                    <div className="flex justify-between gap-3 md:col-span-2"><span className="text-slate-500">네이버 구매자명</span><span className="font-semibold">{selectedRequest.naver_buyer_name}</span></div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">결제 액션</h4>
                    <p className="text-xs text-slate-500 mt-1">현재 상태에서 가능한 작업만 표시됩니다.</p>
                  </div>
                </div>

                {showManualPaymentActions && (
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => {
                        void handlePaymentAction('/api/admin/proxy-bookings/confirm-payment', '결제 확인을 완료했습니다.');
                      }}
                      className="w-full rounded-xl border border-emerald-200 px-3 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
                    >
                      입금 확인
                    </button>
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => {
                        void handlePaymentAction('/api/admin/proxy-bookings/cancel-payment', '결제 취소 처리를 완료했습니다.');
                      }}
                      className="w-full rounded-xl border border-rose-200 px-3 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                    >
                      결제 취소
                    </button>
                  </div>
                )}

                {showManualPaymentActions && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    입금 확인 후에만 진행 상태를 바꿀 수 있습니다.
                  </div>
                )}

                {showCardWaitingHint && (
                  <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                    카드 결제 미완료로 운영 시작 금지 상태입니다. 결제 완료 전에는 진행 상태를 바꿀 수 없습니다.
                  </div>
                )}

                {showRefundAction && (
                  <div className="mt-4">
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => {
                        void handlePaymentAction('/api/admin/proxy-bookings/refund-payment', '환불 처리를 완료했습니다.');
                      }}
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
                  <button type="button" disabled={updating} onClick={() => { void handleUpdateStatus('PENDING'); }} className="w-full rounded-xl bg-slate-900 px-3 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">대기 중</button>
                  <button type="button" disabled={updating || !canStartProcessing} onClick={() => { void handleUpdateStatus('IN_PROGRESS'); }} className="w-full rounded-xl bg-blue-600 px-3 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60">진행 중</button>
                  <button type="button" disabled={updating || !canStartProcessing} onClick={() => { void handleUpdateStatus('COMPLETED'); }} className="w-full rounded-xl bg-emerald-600 px-3 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60">완료</button>
                  <button type="button" disabled={updating} onClick={() => { void handleUpdateStatus('CANCELLED'); }} className="w-full rounded-xl bg-rose-600 px-3 py-3 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60">취소</button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 p-4" data-testid="admin-phone-reservation-form-section">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-bold text-slate-900">폼 작성 내용</h4>
                  {hasExpandableFormEntries && (
                    <button
                      type="button"
                      data-testid="admin-phone-reservation-form-toggle"
                      onClick={() => setShowAllFormEntries((prev) => !prev)}
                      className="text-xs font-semibold text-slate-600 transition hover:text-slate-900"
                    >
                      {showAllFormEntries ? '간단히 보기' : '전체 항목 보기'}
                    </button>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {visibleFormEntries.map((entry) => (
                    <div key={entry.key} data-testid="admin-phone-reservation-form-entry" className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{entry.label}</p>
                      <p className="text-slate-800 mt-1 break-words whitespace-pre-wrap">{entry.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 p-4">
                <div>
                  <h4 className="font-bold text-slate-900">고객 문의함</h4>
                  <p className="text-xs text-slate-500 mt-1">대화와 진행 안내는 1:1 문의함에서 이어서 확인합니다.</p>
                </div>

                {linkedInquiryId ? (
                  <a
                    href={`/admin/dashboard?tab=CHATS&inquiryId=${encodeURIComponent(linkedInquiryId)}`}
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <ExternalLink size={14} />
                    1:1 문의함에서 열기
                  </a>
                ) : (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    연결된 문의 스레드가 없습니다.
                  </div>
                )}
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
