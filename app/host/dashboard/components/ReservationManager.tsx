'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { sendNotification } from '@/app/utils/notification'; 
import Skeleton from '@/app/components/ui/Skeleton';
import EmptyState from '@/app/components/EmptyState'; 
import { useToast } from '@/app/context/ToastContext';
import { useLanguage } from '@/app/context/LanguageContext'; // 🟢 1. import 추가
import { MessageCircle } from 'lucide-react'; // 아이콘 추가
import GuestReviewModal from './GuestReviewModal'; // 모달 추가

// 컴포넌트
import ReservationCard from './ReservationCard';
import GuestProfileModal from './GuestProfileModal';

export default function ReservationManager() {
  const { t } = useLanguage(); // 🟢 2. t 함수 추가
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedBookingForReview, setSelectedBookingForReview] = useState<any>(null);
  const [reviewedBookingIds, setReviewedBookingIds] = useState<number[]>([]); // 작성 완료된 예약 ID 목록

  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [reservations, setReservations] = useState<any[]>([]);
  
  // ✅ [복구] 읽음 처리 상태 & 마운트 상태
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<any>(null);
  
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

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          experiences!inner ( id, title, photos ), 
          guest:profiles!bookings_user_id_fkey ( 
            id, full_name, avatar_url, email, phone, 
            kakao_id, introduction, job, languages, host_nationality 
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
  }, [supabase, showToast]);

  useEffect(() => { fetchReservations(); }, [fetchReservations]);

  // 실시간 알림
  useEffect(() => {
    const channel = supabase.channel('host-dashboard-realtime') 
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, 
        async (payload) => {
          fetchReservations(true); 

          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          if (payload.eventType === 'INSERT') {
            showToast(t('res_toast_new'), 'success'); // 🟢 번역
             await sendNotification({
               recipient_id: user.id,
               type: 'new_booking',
               title: '새로운 예약 도착',
               content: '새로운 예약이 접수되었습니다. 확인해보세요!',
               link_url: '/host/dashboard'
             });
          } 
          else if (payload.eventType === 'UPDATE' && payload.new.status === 'cancellation_requested') {
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
  }, [fetchReservations, supabase, showToast]);

  const addToGoogleCalendar = (res: any) => {
    const title = encodeURIComponent(`[Locally] ${res.experiences?.title} - ${res.guest?.full_name}님`);
    const details = encodeURIComponent(`예약 번호: #${String(res.order_id || res.id)}\n게스트: ${res.guest?.full_name} (${res.guests}명)\n연락처: ${res.guest?.phone || '없음'}`);
    
    const startDate = new Date(`${res.date}T${res.time || '00:00:00'}`);
    const endDate = new Date(startDate.getTime() + (2 * 60 * 60 * 1000));
    
    const formatTime = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const dates = `${formatTime(startDate)}/${formatTime(endDate)}`;
    
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}`, '_blank');
  };

  const handleRequestUserCancel = (res: any) => {
    if (confirm(`${t('res_cancel_ask')}\n${t('res_cancel_confirm_msg')}`)) { // 🟢 번역
      router.push(`/host/dashboard?tab=inquiries&guestId=${res.user_id}`);
    }
  };

  const handleApproveCancel = async (booking: any) => {
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
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredList = reservations.filter(r => {
    const isCancelled = r.status === 'cancelled' || r.status === 'declined';
    const isRequesting = r.status === 'cancellation_requested';
    
    const [year, month, day] = r.date.split('-').map(Number);
    const tripDate = new Date(year, month - 1, day);
    const today = new Date(); 
    today.setHours(0,0,0,0);

    if (activeTab === 'cancelled') return isCancelled || isRequesting;
    if (isCancelled) return false;
    if (activeTab === 'upcoming') return tripDate >= today || isRequesting; 
    if (activeTab === 'completed') return tripDate < today && !isRequesting;
    return true;
  }).sort((a, b) => {
    // ✅ [복구] 정렬 로직 (신규 예약 최상단)
    const newA = isNew(a.created_at, a.id);
    const newB = isNew(b.created_at, b.id);
    
    if (newA !== newB) return newA ? -1 : 1; 
    if ((a.status === 'cancellation_requested') !== (b.status === 'cancellation_requested')) return a.status === 'cancellation_requested' ? -1 : 1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  // ✅ [복구] 하이드레이션 방지 (Skeleton 표시)
  if (!isMounted) return <Skeleton className="w-full h-96 rounded-3xl" />;

  return (
    // ✅ [복구] 높이 고정 (h-[80vh])
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[80vh] flex flex-col">
      
      {/* 헤더 */}
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white sticky top-0 z-10">
        <div>
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
          {t('res_status')} {/* 🟢 기존 키 사용 */}
            <button 
              onClick={() => fetchReservations()} 
              className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
              title="새로고침"
            >
              <RefreshCw size={16} className={loading ? "animate-spin text-blue-500" : ""} />
            </button>
          </h3>
          <p className="text-sm text-slate-500 mt-1">{t('res_desc')}</p> {/* 🟢 기존 키 사용 */}
        </div>
        
        <div className="flex bg-slate-100 p-1.5 rounded-xl">
        {[
            { id: 'upcoming', label: 'tab_upcoming' }, // 🟢 기존 키
            { id: 'completed', label: 'tab_past' },     // 🟢 completed -> tab_past 매핑
            { id: 'cancelled', label: 'tab_cancel' }    // 🟢 cancelled -> tab_cancel 매핑
          ].map(tab => {
             // ✅ [복구] 취소 요청 카운트 계산
             const cancelCount = (tab.id === 'cancelled' || tab.id === 'upcoming') 
               ? reservations.filter(r => r.status === 'cancellation_requested').length : 0;
             
             // ✅ [복구] 신규 예약(N) 여부 계산
             const hasNew = reservations.some(r => {
                const isTabMatch = 
                  tab.id === 'upcoming' ? ['PAID', 'confirmed'].includes(r.status) :
                  tab.id === 'completed' ? r.status === 'completed' :
                  tab.id === 'cancelled' ? ['cancelled', 'cancellation_requested'].includes(r.status) : true;
                return isTabMatch && isNew(r.created_at, r.id);
             });

             return (
               <button
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id as any)}
                 className={`relative px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                   activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                 }`}
               >
{t(tab.label)} {/* 🟢 2. 여기서 t() 함수로 감싸서 번역 출력 */}
                 {/* ✅ [복구] 취소 카운트 뱃지 */}
                 {cancelCount > 0 && <span className="bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{cancelCount}</span>}
                 
                 {/* ✅ [복구] N 뱃지 */}
                 {hasNew && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white ring-2 ring-white shadow-sm">N</span>
                 )}
               </button>
             );
          })}
        </div>
      </div>

      {/* ✅ [복구] 에러 메시지 UI */}
      {errorMsg && (
        <div className="mx-6 mt-4 p-4 bg-red-50 text-red-600 text-sm font-bold flex items-center gap-2 border border-red-100 rounded-xl animate-in slide-in-from-top-2">
          <AlertCircle size={18}/> {errorMsg}
        </div>
      )}

      {/* 리스트 영역 */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
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
                onCancelQuery={() => handleRequestUserCancel(res)}
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