'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import { AlertCircle, CheckCircle, Clock, Phone, Send, XCircle } from 'lucide-react';

import type { PaymentStatus, ProxyComment, ProxyRequest, ProxyStatus } from '@/app/types/proxy';
import {
  getProxyPaymentMethod,
  getProxyRequestTitle,
  getProxyRequesterDisplayName,
  PROXY_REQUEST_PRICE_KRW,
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
      return '결제 실패';
    case 'REFUNDED':
      return '환불 완료';
    default:
      return '결제 대기';
  }
}

export default function PhoneReservationTab() {
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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

  const scheduleRefresh = useCallback((requestId?: string | null) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const nextRequests = await fetchRequests();

        const preferredId = requestId || selectedId;
        if (preferredId && nextRequests.some((item) => item.id === preferredId)) {
          await loadDetail(preferredId);
          return;
        }

        if (nextRequests[0]?.id) {
          setSelectedId(nextRequests[0].id);
        } else {
          setSelectedId(null);
          setSelectedRequest(null);
        }
      } catch (error) {
        console.error('[PhoneReservationTab] refresh failed:', error);
      }
    }, 200);
  }, [fetchRequests, loadDetail, selectedId]);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const nextRequests = await fetchRequests();
        if (!isMounted) return;

        if (nextRequests[0]?.id) {
          setSelectedId(nextRequests[0].id);
        }
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
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'proxy_comments' }, (payload) => {
          const requestId = typeof payload.new?.request_id === 'string' ? payload.new.request_id : null;
          scheduleRefresh(requestId);
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
  }, [fetchRequests, scheduleRefresh, showToast, supabase]);

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

      setRequests((prev) => prev.map((item) => (item.id === selectedId ? { ...item, status: nextStatus } : item)));
      setSelectedRequest((prev) => (prev ? { ...prev, status: nextStatus } : prev));
      showToast('전화 예약 상태를 업데이트했습니다.', 'success');
    } catch (error) {
      console.error('[PhoneReservationTab] update status failed:', error);
      showToast(error instanceof Error ? error.message : '상태 변경에 실패했습니다.', 'error');
    } finally {
      setUpdating(false);
    }
  }, [selectedId, showToast]);

  const handleUpdatePayment = useCallback(async (nextStatus: PaymentStatus) => {
    if (!selectedId) return;

    setUpdating(true);
    try {
      const response = await fetch(`/api/proxy-bookings/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status: nextStatus }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || '결제 상태 변경에 실패했습니다.');
      }

      setRequests((prev) => prev.map((item) => (item.id === selectedId ? { ...item, payment_status: nextStatus } : item)));
      setSelectedRequest((prev) => (prev ? { ...prev, payment_status: nextStatus } : prev));
      showToast('결제 상태를 업데이트했습니다.', 'success');
    } catch (error) {
      console.error('[PhoneReservationTab] update payment failed:', error);
      showToast(error instanceof Error ? error.message : '결제 상태 변경에 실패했습니다.', 'error');
    } finally {
      setUpdating(false);
    }
  }, [selectedId, showToast]);

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

        {requests.length === 0 ? (
          <div className="px-4 py-10 text-sm text-slate-500 text-center">아직 접수된 전화 예약이 없습니다.</div>
        ) : (
          <div className="max-h-[65vh] overflow-y-auto divide-y divide-slate-100">
            {requests.map((item) => {
              const paymentMethod = getProxyPaymentMethod(item.form_data);
              const isSelected = selectedId === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full text-left px-4 py-4 transition-colors ${isSelected ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{item.category}</p>
                      <p className="text-sm font-bold text-slate-900 truncate">{getProxyRequestTitle(item)}</p>
                      <p className="text-xs text-slate-500 mt-1">{getProxyRequesterDisplayName(item.profiles)}</p>
                    </div>
                    <div className="shrink-0">{getStatusBadge(item.status)}</div>
                  </div>
                  <div className="flex items-center justify-between mt-3 text-[11px] text-slate-500">
                    <span>{new Date(item.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    <span>{item.payment_channel}{paymentMethod ? ` · ${paymentMethod === 'card' ? '카드' : '무통장'}` : ''}</span>
                  </div>
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
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{selectedRequest.category}</p>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 space-y-2 text-sm">
                  <h4 className="font-bold text-slate-900">결제 정보</h4>
                  <div className="flex justify-between gap-3"><span className="text-slate-500">결제 채널</span><span className="font-semibold">{selectedRequest.payment_channel}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-slate-500">결제 수단</span><span className="font-semibold">{getProxyPaymentMethod(selectedRequest.form_data) === 'card' ? '카드' : getProxyPaymentMethod(selectedRequest.form_data) === 'bank' ? '무통장' : '미지정'}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-slate-500">서비스 수수료</span><span className="font-semibold">₩{PROXY_REQUEST_PRICE_KRW.toLocaleString()}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-slate-500">결제 상태</span><span className="font-semibold">{getPaymentStatusLabel(selectedRequest.payment_status)}</span></div>
                  {selectedRequest.locally_order_id && (
                    <div className="flex justify-between gap-3"><span className="text-slate-500">주문번호</span><span className="font-mono text-xs">{selectedRequest.locally_order_id}</span></div>
                  )}
                  {selectedRequest.naver_buyer_name && (
                    <div className="flex justify-between gap-3"><span className="text-slate-500">네이버 구매자명</span><span className="font-semibold">{selectedRequest.naver_buyer_name}</span></div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 space-y-3 text-sm">
                  <h4 className="font-bold text-slate-900">운영 액션</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" disabled={updating} onClick={() => handleUpdateStatus('PENDING')} className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60">대기 중</button>
                    <button type="button" disabled={updating} onClick={() => handleUpdateStatus('IN_PROGRESS')} className="px-3 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-60">진행 중</button>
                    <button type="button" disabled={updating} onClick={() => handleUpdateStatus('COMPLETED')} className="px-3 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60">완료</button>
                    <button type="button" disabled={updating} onClick={() => handleUpdateStatus('CANCELLED')} className="px-3 py-2 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-60">취소</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" disabled={updating} onClick={() => handleUpdatePayment('WAITING')} className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60">결제 대기</button>
                    <button type="button" disabled={updating} onClick={() => handleUpdatePayment('COMPLETED')} className="px-3 py-2 text-xs font-semibold rounded-xl border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-60">결제 완료</button>
                    <button type="button" disabled={updating} onClick={() => handleUpdatePayment('FAILED')} className="px-3 py-2 text-xs font-semibold rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-60">결제 실패</button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 p-4">
                <h4 className="font-bold text-slate-900 mb-3">폼 작성 내용</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {Object.entries(selectedRequest.form_data || {}).map(([key, value]) => (
                    value ? (
                      <div key={key} className="rounded-xl bg-slate-50 px-3 py-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{key.replace(/_/g, ' ')}</p>
                        <p className="text-slate-800 mt-1 break-words">{String(value)}</p>
                      </div>
                    ) : null
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle size={16} className="text-slate-500" />
                  <h4 className="font-bold text-slate-900">고객 소통</h4>
                </div>

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
