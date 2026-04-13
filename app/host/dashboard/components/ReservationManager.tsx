'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Skeleton from '@/app/components/ui/Skeleton';
import EmptyState from '@/app/components/EmptyState';
import ConfirmModal from '@/app/components/ui/ConfirmModal';
import { useToast } from '@/app/context/ToastContext';
import { useLanguage } from '@/app/context/LanguageContext'; // 🟢 1. import 추가
import GuestReviewModal from './GuestReviewModal'; // 모달 추가
import {
  isCancellationRequestedBookingStatus,
  isCancelledBookingStatus,
  isPendingBookingStatus,
} from '@/app/constants/bookingStatus';
import { getHostDashboardHref } from '@/app/host/dashboard/navigation';
import type { LocallyMembershipStatus } from '@/app/utils/memberStatus';

// 컴포넌트
import ReservationCard from './ReservationCard';
import GuestProfileModal from './GuestProfileModal';

type ReservationGuest = {
  id: string | number;
  full_name?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  introduction?: string | null;
  bio?: string | null;
  job?: string | null;
  languages?: string[] | string | null;
  nationality?: string | null;
  gender?: string | null;
  mbti?: string | null;
  created_at?: string | null;
};

type ReservationExperience = {
  title?: string | null;
};

type ReservationGuestRelation = ReservationGuest | ReservationGuest[] | null;
type ReservationExperienceRelation = ReservationExperience | ReservationExperience[] | null;

type ReservationRecord = {
  id: string | number;
  order_id?: string | number | null;
  user_id: string;
  experience_id?: string | number | null;
  created_at: string;
  date: string;
  time?: string | null;
  guests?: number | null;
  amount?: number | null;
  total_price?: number | null;
  total_experience_price?: number | null;
  status: string;
  contact_name?: string | null;
  cancel_reason?: string | null;
  refund_amount?: number | null;
  host_payout_amount?: number | null;
  guest?: ReservationGuest | null;
  experiences?: ReservationExperience | null;
};

type RawReservationRecord = Omit<ReservationRecord, 'guest' | 'experiences'> & {
  guest?: ReservationGuestRelation;
  experiences?: ReservationExperienceRelation;
};

type HostExperienceRef = {
  id: string | number;
};

type BookingRealtimePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  new: {
    status?: string;
    experience_id?: string | number | null;
  };
  old: {
    experience_id?: string | number | null;
  };
};

type GuestReviewBookingIdRow = {
  booking_id: string | number;
};

type GuestMembershipResponse = {
  success?: boolean;
  memberships?: Record<string, LocallyMembershipStatus>;
};

const RESERVATION_SELECT = `
  id,
  order_id,
  user_id,
  experience_id,
  created_at,
  date,
  time,
  guests,
  amount,
  total_price,
  total_experience_price,
  status,
  contact_name,
  cancel_reason,
  refund_amount,
  host_payout_amount,
  experiences!inner (
    title
  ),
  guest:profiles!bookings_user_id_fkey (
    id,
    full_name,
    avatar_url,
    phone,
    created_at,
    introduction,
    bio,
    job,
    languages,
    nationality,
    gender,
    mbti
  )
`;

const REALTIME_REFRESH_DEBOUNCE_MS = 350;

function getSingleGuest(guest?: ReservationGuestRelation) {
  if (Array.isArray(guest)) return guest[0] ?? null;
  return guest ?? null;
}

function getSingleExperience(experience?: ReservationExperienceRelation) {
  if (Array.isArray(experience)) return experience[0] ?? null;
  return experience ?? null;
}

export default function ReservationManager() {
  const { t } = useLanguage(); // 🟢 2. t 함수 추가
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedBookingForReview, setSelectedBookingForReview] = useState<ReservationRecord | null>(null);
  const [reviewedBookingIds, setReviewedBookingIds] = useState<string[]>([]); // 작성 완료된 예약 ID 목록
  const hostExperienceIdsRef = useRef<Set<string>>(new Set());
  const hostUserIdRef = useRef<string | null>(null);
  const realtimeRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const membershipRequestSeqRef = useRef(0);

  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);

  // ✅ [복구] 읽음 처리 상태 & 마운트 상태
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | number | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<ReservationGuest | null>(null);
  const [pendingRefundBooking, setPendingRefundBooking] = useState<ReservationRecord | null>(null);
  const [membershipByUserId, setMembershipByUserId] = useState<Record<string, LocallyMembershipStatus>>({});

  // ✅ [복구] 에러 메시지 상태
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ✅ [복구] 초기화 로직 (localStorage 로드)
  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('host_checked_reservations');
    if (saved) {
      try {
        setCheckedIds(
          (JSON.parse(saved) as Array<string | number>).map((id) => String(id))
        );
      } catch (e) {
        console.error("Failed to parse checked reservations", e);
      }
    }
  }, []);

  // ✅ [복구] 읽음 처리 함수
  const markAsRead = (id: string | number) => {
    const normalizedId = String(id);
    if (!checkedIds.includes(normalizedId)) {
      const newChecked = [...checkedIds, normalizedId];
      setCheckedIds(newChecked);
      localStorage.setItem('host_checked_reservations', JSON.stringify(newChecked));
    }
  };

  // ✅ [복구] 신규 예약 판별 로직 (24시간 이내 & 안 읽음)
  const isNew = (createdAt: string, id: string | number) => {
    if (!isMounted) return false;
    if (checkedIds.includes(String(id))) return false; // 이미 읽었으면 New 아님
    return (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60) < 24;
  };

  const getHostUserId = useCallback(async () => {
    if (hostUserIdRef.current) {
      return hostUserIdRef.current;
    }

    const { data: { user } } = await supabase.auth.getUser();
    hostUserIdRef.current = user?.id ?? null;
    return hostUserIdRef.current;
  }, [supabase]);

  const clearRealtimeRefresh = useCallback(() => {
    if (realtimeRefreshTimeoutRef.current) {
      clearTimeout(realtimeRefreshTimeoutRef.current);
      realtimeRefreshTimeoutRef.current = null;
    }
  }, []);

  const fetchGuestMembershipStatuses = useCallback(async (guestIds: string[]) => {
    const requestSeq = membershipRequestSeqRef.current + 1;
    membershipRequestSeqRef.current = requestSeq;

    const normalizedGuestIds = [...new Set(guestIds.map((guestId) => String(guestId || '')).filter(Boolean))];

    if (normalizedGuestIds.length === 0) {
      if (membershipRequestSeqRef.current === requestSeq) {
        setMembershipByUserId({});
      }
      return;
    }

    try {
      const response = await fetch('/api/host/reservations/guest-memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestIds: normalizedGuestIds }),
      });

      if (!response.ok) {
        throw new Error('Failed to resolve guest memberships.');
      }

      const payload = (await response.json()) as GuestMembershipResponse;
      if (membershipRequestSeqRef.current === requestSeq) {
        setMembershipByUserId(payload.memberships || {});
      }
    } catch (error) {
      console.error('[ReservationManager] guest membership lookup failed:', error);
      if (membershipRequestSeqRef.current === requestSeq) {
        setMembershipByUserId({});
      }
    }
  }, []);

  const fetchReservations = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      setErrorMsg(null);

      const hostUserId = await getHostUserId();
      if (!hostUserId) return;

      const { data: hostExperiences } = await supabase
        .from('experiences')
        .select('id')
        .eq('host_id', hostUserId);
      const hostExperienceRows = (hostExperiences as HostExperienceRef[] | null) || [];
      hostExperienceIdsRef.current = new Set(hostExperienceRows.map((item) => String(item.id)));

      const { data, error } = await supabase
        .from('bookings')
        .select(RESERVATION_SELECT)
        .eq('experiences.host_id', hostUserId);

      if (error) throw error;
      const nextReservations = ((data as RawReservationRecord[] | null) || []).map((reservation) => ({
        ...reservation,
        guest: getSingleGuest(reservation.guest),
        experiences: getSingleExperience(reservation.experiences),
      }));
      setReservations(nextReservations);
      void fetchGuestMembershipStatuses(nextReservations.map((reservation) => reservation.user_id));

      // 🟢 [추가] 이미 후기를 작성한 예약 ID 조회
      const bookingIds = nextReservations
        .map((reservation) => String(reservation.id || ''))
        .filter(Boolean);

      if (bookingIds.length === 0) {
        setReviewedBookingIds([]);
      } else {
        const { data: reviews, error: reviewsError } = await supabase
          .from('guest_reviews')
          .select('booking_id')
          .eq('host_id', hostUserId)
          .in('booking_id', bookingIds);

        if (reviewsError) {
          console.error('[ReservationManager] guest_reviews lookup error:', reviewsError);
          setReviewedBookingIds([]);
        } else {
          setReviewedBookingIds(
            ((reviews as GuestReviewBookingIdRow[] | null) || []).map((review) => String(review.booking_id))
          );
        }
      }

    } catch (error) {
      console.error(error);
      // ✅ [복구] 에러 메시지 설정
      setErrorMsg(t('res_toast_error_load')); // 🟢 번역
      if (!isBackground) showToast(t('res_toast_error_load'), 'error');
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [fetchGuestMembershipStatuses, getHostUserId, showToast, supabase, t]);

  const scheduleRealtimeRefresh = useCallback(() => {
    clearRealtimeRefresh();
    realtimeRefreshTimeoutRef.current = setTimeout(() => {
      realtimeRefreshTimeoutRef.current = null;
      void fetchReservations(true);
    }, REALTIME_REFRESH_DEBOUNCE_MS);
  }, [clearRealtimeRefresh, fetchReservations]);

  useEffect(() => { fetchReservations(); }, [fetchReservations]);

  // 실시간 알림
  useEffect(() => {
    const channel = supabase.channel('host-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' },
        async (payload) => {
          const eventPayload = payload as BookingRealtimePayload;
          const changedExperienceId = String(eventPayload.new?.experience_id || eventPayload.old?.experience_id || '');
          if (!changedExperienceId || !hostExperienceIdsRef.current.has(changedExperienceId)) return;

          scheduleRealtimeRefresh();

          if (eventPayload.eventType === 'INSERT') {
            // Persistent host notifications are created by the booking owner route.
            // The realtime dashboard layer only surfaces an in-session toast.
            showToast(t('res_toast_new'), 'success'); // 🟢 번역
          }
          else if (eventPayload.eventType === 'UPDATE' && eventPayload.new?.status && isCancellationRequestedBookingStatus(eventPayload.new.status)) {
            // Review-pending cancellation notifications are created by the cancel owner route.
            // The realtime dashboard layer only surfaces an in-session toast.
            showToast(t('res_toast_cancel'), 'error'); // 🟢 번역
          }
        }
      ).subscribe();

    return () => {
      clearRealtimeRefresh();
      supabase.removeChannel(channel);
    };
  }, [clearRealtimeRefresh, scheduleRealtimeRefresh, supabase, showToast, t]);

  const addToGoogleCalendar = (res: ReservationRecord) => {
    const guestDisplayName = res.guest?.full_name || res.contact_name || t('res_gcal_none');
    const title = encodeURIComponent(`${t('res_gcal_title_prefix')}${res.experiences?.title} - ${guestDisplayName}`);
    const details = encodeURIComponent(`${t('res_gcal_details_order')}${String(res.order_id || res.id)}\n${t('res_gcal_details_guest')}${guestDisplayName} (${res.guests}${t('res_gcal_details_persons')})\n${t('res_gcal_details_contact')}${res.guest?.phone || t('res_gcal_none')}`);

    const startDate = new Date(`${res.date}T${res.time || '00:00:00'}`);
    const endDate = new Date(startDate.getTime() + (2 * 60 * 60 * 1000));

    const formatTime = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const dates = `${formatTime(startDate)}/${formatTime(endDate)}`;

    window.location.href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}`;
  };

  const handleApproveCancel = async (booking: ReservationRecord) => {
    setProcessingId(booking.id);

    try {
      const res = await fetch('/api/payment/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id, reason: t('res_reason_host_approved') }),
      });
      if (!res.ok) throw new Error(t('res_error_refund'));

      showToast(t('res_toast_approved'), 'success'); // 🟢 번역
      fetchReservations(true);
      setPendingRefundBooking(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('res_error_refund_unknown');
      showToast(message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const isReservationInTab = useCallback((r: ReservationRecord, tab: 'upcoming' | 'completed' | 'cancelled') => {
    const isCancelled = isCancelledBookingStatus(r.status) && !isCancellationRequestedBookingStatus(r.status);
    const isRequesting = isCancellationRequestedBookingStatus(r.status);

    const [year, month, day] = r.date.split('-').map(Number);
    const tripDate = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isPending = isPendingBookingStatus(r.status); // 🟢 추가

    if (tab === 'cancelled') return isCancelled || isRequesting;
    if (isCancelled) return false;

    // 🟢 [수정] PENDING 상태도 '예정된 예약'으로 취급
    if (tab === 'upcoming') return tripDate >= today || isRequesting || isPending;

    if (tab === 'completed') return tripDate < today && !isRequesting && !isPending;
    return true;
  }, []);

  const filteredList = reservations.filter(r => isReservationInTab(r, activeTab)).sort((a, b) => {
    // ✅ [복구] 정렬 로직 (신규 예약 최상단)
    const newA = isNew(a.created_at, a.id);
    const newB = isNew(b.created_at, b.id);

    if (newA !== newB) return newA ? -1 : 1;
    if (isCancellationRequestedBookingStatus(a.status) !== isCancellationRequestedBookingStatus(b.status)) {
      return isCancellationRequestedBookingStatus(a.status) ? -1 : 1;
    }
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const actionableReservationCount = reservations.filter((reservation) => {
    const [year, month, day] = reservation.date.split('-').map(Number);
    const tripDate = new Date(year, month - 1, day);
    const baseToday = new Date();
    baseToday.setHours(0, 0, 0, 0);
    return (
      !isCancelledBookingStatus(reservation.status) &&
      !isCancellationRequestedBookingStatus(reservation.status) &&
      (tripDate >= baseToday || isPendingBookingStatus(reservation.status))
    );
  }).length;
  const cancellationRequestCount = reservations.filter((reservation) =>
    isCancellationRequestedBookingStatus(reservation.status)
  ).length;

  // ✅ [복구] 하이드레이션 방지 (Skeleton 표시)
  if (!isMounted) return <Skeleton className="w-full h-96 rounded-3xl" />;

  return (
    // ✅ [복구] 높이 고정 (h-[80vh])
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px] md:min-h-[750px] h-full flex flex-col">

      {/* 헤더 */}
      <div className="px-4 py-4 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4 bg-white sticky top-0 z-10">
        <div>
          <h3 className="text-[15px] md:text-xl font-black text-slate-900 flex items-center gap-1.5">
            {t('res_status')}
            <button
              onClick={() => fetchReservations()}
              className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
              title={t('hp_refresh')}
            >
              <RefreshCw size={13} className={loading ? "animate-spin text-blue-500" : ""} />
            </button>
          </h3>
          <p className="hidden md:block text-sm text-slate-500 mt-1">{t('res_desc')}</p>
        </div>

        <div className="flex w-full sm:w-auto bg-slate-100 p-1 rounded-2xl">
          {[
            { id: 'upcoming', label: 'tab_upcoming' },
            { id: 'completed', label: 'res_tab_past' },
            { id: 'cancelled', label: 'tab_cancel' }
          ].map(tab => {
            const cancelCount = (tab.id === 'cancelled' || tab.id === 'upcoming')
              ? reservations.filter(r => isCancellationRequestedBookingStatus(r.status)).length : 0;

            const hasNew = reservations.some(r => {
              const isTabMatch = isReservationInTab(r, tab.id as 'upcoming' | 'completed' | 'cancelled');
              return isTabMatch && isNew(r.created_at, r.id);
            });

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'upcoming' | 'completed' | 'cancelled')}
                className={`relative flex-1 sm:flex-none px-3.5 py-2 text-[12px] md:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
              >
                {t(tab.label)}
                {cancelCount > 0 && <span className="bg-orange-500 text-white text-[9px] px-1 py-0.5 rounded-full">{cancelCount}</span>}
                {hasNew && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] text-white ring-2 ring-white">N</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ✅ [복구] 에러 메시지 UI */}
      {errorMsg && (
        <div className="mx-6 mt-4 p-4 bg-red-50 text-red-600 text-sm font-bold flex items-center gap-2 border border-red-100 rounded-xl animate-in slide-in-from-top-2">
          <AlertCircle size={18} /> {errorMsg}
        </div>
      )}

      {reservations.length > 0 && (
        <div className="mx-4 md:mx-6 mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-slate-400" />
            <div className="min-w-0">
              <p className="text-[12px] md:text-[13px] font-semibold leading-5">
                {t('host_dashboard_warning_strip')}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600">
                {actionableReservationCount > 0 && (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">
                    {t('tab_upcoming')} {actionableReservationCount}
                  </span>
                )}
                {cancellationRequestCount > 0 && (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">
                    {t('res_cancel_req')} {cancellationRequestCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 리스트 영역 */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
        {loading && reservations.length === 0 ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border rounded-2xl p-6 bg-white flex gap-4">
                <Skeleton className="w-24 h-24 rounded-xl shrink-0" />
                <div className="space-y-3 flex-1 flex flex-col justify-center">
                  <Skeleton className="w-1/3 h-5" />
                  <Skeleton className="w-1/4 h-4" />
                  <div className="mt-auto">
                    <Skeleton className="w-full h-10 rounded-lg mt-2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredList.length === 0 ? (
          // ✅ [복구] 탭별 상황에 맞는 Empty State 문구
          <EmptyState
            title={t('res_empty_title')}
            subtitle={activeTab === 'upcoming'
              ? t('res_empty_upcoming')
              : activeTab === 'cancelled'
                ? t('res_empty_cancelled')
                : t('res_empty_date')}
          />
        ) : (
          <div className="space-y-4">
            {filteredList.map(res => (
              <ReservationCard
                key={res.id}
                res={{
                  ...res,
                  membershipStatus: membershipByUserId[String(res.user_id)] || 'none',
                }}
                isNew={isNew(res.created_at, res.id)}
                isProcessing={processingId === res.id}
                onApproveCancel={() => setPendingRefundBooking(res)}
                onShowProfile={() => setSelectedGuest(res.guest || null)}
                onCheck={() => markAsRead(res.id)}
                onMessage={() =>
                  router.push(
                    getHostDashboardHref('inquiries', {
                      guestId: res.user_id,
                      expId: res.experience_id || undefined,
                    })
                  )
                }
                onCalendar={() => addToGoogleCalendar(res)}
                // 🟢 [추가] 후기 관련 Props
                hasReview={reviewedBookingIds.includes(String(res.id))}
                onReview={() => {
                  const [year, month, day] = res.date.split('-').map(Number);
                  const tripDate = new Date(year, month - 1, day);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);

                  if (tripDate >= today) {
                    showToast(t('res_review_before_tour'), 'error');
                    return;
                  }

                  setSelectedBookingForReview(res);
                  setReviewModalOpen(true);
                }}

              />
            ))}
          </div>
        )}
      </div>

      {selectedGuest && (
        <GuestProfileModal
          guest={selectedGuest}
          membershipStatus={membershipByUserId[String(selectedGuest.id)] || 'none'}
          onClose={() => setSelectedGuest(null)}
        />
      )}
      {reviewModalOpen && selectedBookingForReview && (
        <GuestReviewModal
          booking={selectedBookingForReview}
          onClose={() => setReviewModalOpen(false)}
          onSuccess={() => fetchReservations(true)} // 목록 갱신
        />
      )}
      <ConfirmModal
        isOpen={!!pendingRefundBooking}
        onCancel={() => setPendingRefundBooking(null)}
        onConfirm={() => {
          if (!pendingRefundBooking) return;
          void handleApproveCancel(pendingRefundBooking);
        }}
        title={t('res_approve_refund')}
        description={pendingRefundBooking
          ? `${t('res_refund_confirm_prefix')}${pendingRefundBooking.guest?.full_name || pendingRefundBooking.contact_name || ''}${t('res_refund_confirm_suffix')}`
          : ''}
        confirmLabel={t('res_approve_refund')}
        cancelLabel={t('button_close')}
        tone="red"
        isProcessing={pendingRefundBooking ? processingId === pendingRefundBooking.id : false}
      />
    </div>
  );
}
