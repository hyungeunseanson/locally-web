'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { sendNotification } from '@/app/utils/notification';
import Skeleton from '@/app/components/ui/Skeleton';
import EmptyState from '@/app/components/EmptyState';
import { useToast } from '@/app/context/ToastContext';
import { useLanguage } from '@/app/context/LanguageContext'; // 🟢 1. import 추가
import GuestReviewModal from './GuestReviewModal'; // 모달 추가
import {
  isCancellationRequestedBookingStatus,
  isCancelledBookingStatus,
  isPendingBookingStatus,
} from '@/app/constants/bookingStatus';

// 컴포넌트
import ReservationCard from './ReservationCard';
import GuestProfileModal from './GuestProfileModal';

type ReservationGuest = {
  id: string | number;
  full_name?: string | null;
  avatar_url?: string | null;
  email?: string | null;
  phone?: string | null;
  kakao_id?: string | null;
  introduction?: string | null;
  bio?: string | null;
  job?: string | null;
  school?: string | null;
  languages?: string[] | string | null;
  nationality?: string | null;
  gender?: string | null;
  mbti?: string | null;
  created_at?: string | null;
};

type ReservationExperience = {
  id: string | number;
  title?: string | null;
  photos?: string[] | null;
};

type ReservationRecord = {
  id: number;
  order_id?: string | number | null;
  user_id: string;
  experience_id?: string | number | null;
  created_at: string;
  date: string;
  time?: string | null;
  guests?: number | null;
  status: string;
  guest?: ReservationGuest | null;
  experiences?: ReservationExperience | null;
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

export default function ReservationManager() {
  const { t } = useLanguage(); // 🟢 2. t 함수 추가
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedBookingForReview, setSelectedBookingForReview] = useState<ReservationRecord | null>(null);
  const [reviewedBookingIds, setReviewedBookingIds] = useState<number[]>([]); // 작성 완료된 예약 ID 목록
  const hostExperienceIdsRef = useRef<Set<string>>(new Set());

  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);

  // ✅ [복구] 읽음 처리 상태 & 마운트 상태
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<ReservationGuest | null>(null);

  // ✅ [복구] 에러 메시지 상태
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ✅ [복구] 초기화 로직 (localStorage 로드)
  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('host_checked_reservations');
    if (saved) {
      try {
        setCheckedIds(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse checked reservations", e);
      }
    }
  }, []);

  // ✅ [복구] 읽음 처리 함수
  const markAsRead = (id: number) => {
    if (!checkedIds.includes(id)) {
      const newChecked = [...checkedIds, id];
      setCheckedIds(newChecked);
      localStorage.setItem('host_checked_reservations', JSON.stringify(newChecked));
    }
  };

  // ✅ [복구] 신규 예약 판별 로직 (24시간 이내 & 안 읽음)
  const isNew = (createdAt: string, id: number) => {
    if (!isMounted) return false;
    if (checkedIds.includes(id)) return false; // 이미 읽었으면 New 아님
    return (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60) < 24;
  };

  const fetchReservations = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      setErrorMsg(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: hostExperiences } = await supabase
        .from('experiences')
        .select('id')
        .eq('host_id', user.id);
      const hostExperienceRows = (hostExperiences as HostExperienceRef[] | null) || [];
      hostExperienceIdsRef.current = new Set(hostExperienceRows.map((item) => String(item.id)));

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          experiences!inner ( id, title, photos ), 
guest:profiles!bookings_user_id_fkey ( 
            id, full_name, avatar_url, email, phone, 
            kakao_id, introduction, bio, job, school, languages, nationality,
            gender, mbti 
          )
        `)
        .eq('experiences.host_id', user.id);

      if (error) throw error;
      setReservations(data || []);
      // 🟢 [추가] 이미 후기를 작성한 예약 ID 조회
      const { data: reviews } = await supabase
        .from('guest_reviews')
        .select('booking_id')
        .eq('host_id', user.id);

      if (reviews) {
        setReviewedBookingIds(reviews.map(r => r.booking_id));
      }

    } catch (error) {
      console.error(error);
      // ✅ [복구] 에러 메시지 설정
      setErrorMsg(t('res_error_load')); // 🟢 번역
      if (!isBackground) showToast('예약 정보를 불러오는데 실패했습니다.', 'error');
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [supabase, showToast, t]);

  useEffect(() => { fetchReservations(); }, [fetchReservations]);

  // 실시간 알림
  useEffect(() => {
    const channel = supabase.channel('host-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' },
        async (payload) => {
          const eventPayload = payload as BookingRealtimePayload;
          const changedExperienceId = String(eventPayload.new?.experience_id || eventPayload.old?.experience_id || '');
          if (!changedExperienceId || !hostExperienceIdsRef.current.has(changedExperienceId)) return;

          fetchReservations(true);

          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          if (eventPayload.eventType === 'INSERT') {
            showToast(t('res_toast_new'), 'success'); // 🟢 번역
            await sendNotification({
              recipient_id: user.id,
              type: 'new_booking',
              title: '새로운 예약 도착',
              content: '새로운 예약이 접수되었습니다. 확인해보세요!',
              link_url: '/host/dashboard'
            });
          }
          else if (eventPayload.eventType === 'UPDATE' && isCancellationRequestedBookingStatus(eventPayload.new.status)) {
            showToast(t('res_toast_cancel'), 'error'); // 🟢 번역
            await sendNotification({
              recipient_id: user.id,
              type: 'booking_cancel_request',
              title: '예약 취소 요청',
              content: '게스트가 예약을 취소하고 싶어합니다. 확인해주세요.',
              link_url: '/host/dashboard?tab=cancelled'
            });
          }
        }
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchReservations, supabase, showToast, t]);

  const addToGoogleCalendar = (res: ReservationRecord) => {
    const title = encodeURIComponent(`[Locally] ${res.experiences?.title} - ${res.guest?.full_name}님`);
    const details = encodeURIComponent(`예약 번호: #${String(res.order_id || res.id)}\n게스트: ${res.guest?.full_name} (${res.guests}명)\n연락처: ${res.guest?.phone || '없음'}`);

    const startDate = new Date(`${res.date}T${res.time || '00:00:00'}`);
    const endDate = new Date(startDate.getTime() + (2 * 60 * 60 * 1000));

    const formatTime = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const dates = `${formatTime(startDate)}/${formatTime(endDate)}`;

    window.location.href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}`;
  };

  const handleApproveCancel = async (booking: ReservationRecord) => {
    if (!confirm(`${t('res_refund_confirm_prefix')}${booking.guest?.full_name}${t('res_refund_confirm_suffix')}`)) return; // 🟢 번역
    setProcessingId(booking.id);

    try {
      const res = await fetch('/api/payment/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id, reason: '호스트 승인' }),
      });
      if (!res.ok) throw new Error('환불 처리에 실패했습니다.');

      await sendNotification({
        recipient_id: booking.user_id,
        type: 'cancellation_approved',
        title: '취소 요청 승인됨',
        content: `'${booking.experiences?.title}' 예약 취소가 승인되어 환불이 진행됩니다.`,
        link_url: '/guest/trips'
      });

      showToast(t('res_toast_approved'), 'success'); // 🟢 번역
      fetchReservations(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '환불 처리 중 오류가 발생했습니다.';
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

  // ✅ [복구] 하이드레이션 방지 (Skeleton 표시)
  if (!isMounted) return <Skeleton className="w-full h-96 rounded-3xl" />;

  return (
    // ✅ [복구] 높이 고정 (h-[80vh])
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px] md:min-h-[750px] h-full flex flex-col">

      {/* 헤더 */}
      <div className="px-4 py-3 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 md:gap-4 bg-white sticky top-0 z-10">
        <div>
          <h3 className="text-[14px] md:text-xl font-black text-slate-900 flex items-center gap-1.5">
            {t('res_status')}
            <button
              onClick={() => fetchReservations()}
              className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
              title="새로고침"
            >
              <RefreshCw size={13} className={loading ? "animate-spin text-blue-500" : ""} />
            </button>
          </h3>
          <p className="hidden md:block text-sm text-slate-500 mt-1">{t('res_desc')}</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl">
          {[
            { id: 'upcoming', label: 'tab_upcoming' },
            { id: 'completed', label: 'tab_past' },
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
                className={`relative px-3 py-1.5 text-[11px] md:text-sm font-bold rounded-lg transition-all flex items-center gap-1 ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
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

      {/* 리스트 영역 */}
      <div className="flex-1 overflow-y-auto p-3 md:p-6 bg-slate-50">
        {loading && reservations.length === 0 ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border rounded-2xl p-6 bg-white flex gap-4">
                <Skeleton className="w-24 h-24 rounded-xl" />
                <div className="space-y-3 flex-1">
                  <Skeleton className="w-1/3 h-5" />
                  <Skeleton className="w-1/4 h-4" />
                  <Skeleton className="w-full h-10 rounded-lg" />
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
                res={res}
                // ✅ [복구] isNew, onCheck 로직 전달
                isNew={isNew(res.created_at, res.id)}
                isProcessing={processingId === res.id}
                onApproveCancel={() => handleApproveCancel(res)}
                onShowProfile={() => setSelectedGuest(res.guest)}
                onCheck={() => markAsRead(res.id)}
                onMessage={() => router.push(`/host/dashboard?tab=inquiries&guestId=${res.user_id}`)}
                onCalendar={() => addToGoogleCalendar(res)}
                // 🟢 [추가] 후기 관련 Props
                hasReview={reviewedBookingIds.includes(res.id)}
                onReview={() => {
                  setSelectedBookingForReview(res);
                  setReviewModalOpen(true);
                }}

              />
            ))}
          </div>
        )}
      </div>

      {selectedGuest && (
        <GuestProfileModal guest={selectedGuest} onClose={() => setSelectedGuest(null)} />
      )}
      {reviewModalOpen && selectedBookingForReview && (
        <GuestReviewModal
          booking={selectedBookingForReview}
          onClose={() => setReviewModalOpen(false)}
          onSuccess={() => fetchReservations(true)} // 목록 갱신
        />
      )}
    </div>
  );
}
