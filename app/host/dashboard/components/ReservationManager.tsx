'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { sendNotification } from '@/app/utils/notification'; 
import Skeleton from '@/app/components/ui/Skeleton';
import EmptyState from '@/app/components/EmptyState'; // ✅ 기존 승: 컴포넌트 재사용
import { useToast } from '@/app/context/ToastContext';

// 컴포넌트
import ReservationCard from './ReservationCard';
import GuestProfileModal from './GuestProfileModal';

export default function ReservationManager() {
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [reservations, setReservations] = useState<any[]>([]);
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null); // ✅ 새 코드 승: 에러 메시지 UI
  const [isMounted, setIsMounted] = useState(false); // ✅ 기존 승: 하이드레이션 방지

  // 1️⃣ 초기화: 마운트 확인 및 읽음 데이터 로드
  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('host_checked_reservations');
    if (saved) setCheckedIds(JSON.parse(saved));
  }, []);

  // 2️⃣ 데이터 로드
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

    } catch (error) {
      console.error(error);
      setErrorMsg('예약 정보를 불러오는데 실패했습니다.'); // UI 표시
      if (!isBackground) showToast('예약 정보를 불러오는데 실패했습니다.', 'error'); // Toast 표시
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [supabase, showToast]);

  useEffect(() => { fetchReservations(); }, [fetchReservations]);

  // 3️⃣ 실시간 알림 시스템 (기존 로직 복구)
  useEffect(() => {
    const channel = supabase.channel('host-dashboard-realtime') // ✅ 기존 승: 채널명 유지
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, 
        async (payload) => {
          fetchReservations(true); 

          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          // 신규 예약 알림
          if (payload.eventType === 'INSERT') {
             showToast('🎉 새로운 예약이 도착했습니다!', 'success');
             // ✅ 기존 승: 알림 발송 로직 복구
             await sendNotification({
               recipient_id: user.id,
               type: 'new_booking',
               title: '새로운 예약 도착',
               content: '새로운 예약이 접수되었습니다. 확인해보세요!',
               link_url: '/host/dashboard'
             });
          } 
          // 취소 요청 알림
          else if (payload.eventType === 'UPDATE' && payload.new.status === 'cancellation_requested') {
            showToast('🚨 예약 취소 요청이 접수되었습니다.', 'error');
             await sendNotification({
                recipient_id: user.id,
                type: 'booking_cancel_request', // ✅ 기존 승: 타입명 유지
                title: '예약 취소 요청',
                content: '게스트가 예약을 취소하고 싶어합니다. 확인해주세요.',
                link_url: '/host/dashboard?tab=cancelled'
              });
          }
        }
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchReservations, supabase, showToast]);

  // --- 기능 핸들러 ---

  const markAsRead = (id: number) => {
    if (!checkedIds.includes(id)) {
      const newChecked = [...checkedIds, id];
      setCheckedIds(newChecked);
      localStorage.setItem('host_checked_reservations', JSON.stringify(newChecked));
    }
  };

  // ✅ 기존 승: isMounted 체크로 하이드레이션 에러 방지
  const isNew = (createdAt: string, id: number) => {
    if (!isMounted) return false;
    if (checkedIds.includes(id)) return false; 
    return (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60) < 24; 
  };

  // ✅ 기존 승: 시작/종료 시간 포함하여 정확한 일정 생성
  const addToGoogleCalendar = (res: any) => {
    const title = encodeURIComponent(`[Locally] ${res.experiences?.title} - ${res.guest?.full_name}님`);
    const details = encodeURIComponent(`예약 번호: #${String(res.order_id || res.id)}\n게스트: ${res.guest?.full_name} (${res.guests}명)\n연락처: ${res.guest?.phone || '없음'}`);
    
    // 날짜 및 시간 파싱 (안전한 방식)
    const startDate = new Date(`${res.date}T${res.time || '00:00:00'}`);
    const endDate = new Date(startDate.getTime() + (2 * 60 * 60 * 1000)); // 기본 2시간 체험으로 가정
    
    const formatTime = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const dates = `${formatTime(startDate)}/${formatTime(endDate)}`;
    
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}`, '_blank');
  };

  // ✅ 기존 승: 게스트에게 취소 문의 (채팅)
  const handleRequestUserCancel = (res: any) => {
    if (confirm(`게스트에게 직접 취소를 요청하시겠습니까?\n'확인'을 누르면 채팅방으로 이동합니다.`)) {
      router.push(`/host/dashboard?tab=inquiries&guestId=${res.user_id}`);
    }
  };

  const handleApproveCancel = async (booking: any) => {
    if (!confirm(`'${booking.guest?.full_name}' 님의 취소를 승인하고 환불하시겠습니까?`)) return;
    setProcessingId(booking.id);
    
    try {
      const res = await fetch('/api/payment/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id, reason: '호스트 승인' }),
      });
      if (!res.ok) throw new Error('환불 처리에 실패했습니다.');
      
      // ✅ 기존 승: 게스트에게 승인 알림 발송 복구
      await sendNotification({
        recipient_id: booking.user_id,
        type: 'cancellation_approved', 
        title: '취소 요청 승인됨',
        content: `'${booking.experiences?.title}' 예약 취소가 승인되어 환불이 진행됩니다.`,
        link_url: '/guest/trips'
      });

      showToast('취소가 승인되었습니다.', 'success');
      fetchReservations(true);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // ✅ 기존 승: 안전한 날짜 필터링 및 정렬
  const filteredList = reservations.filter(r => {
    const isCancelled = r.status === 'cancelled' || r.status === 'declined';
    const isRequesting = r.status === 'cancellation_requested';
    
    // 날짜 파싱 안전하게 (UTC 이슈 방지)
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
    // 🟢 [변경] 정렬 우선순위 명확화
    const newA = isNew(a.created_at, a.id);
    const newB = isNew(b.created_at, b.id);
    
    // 1순위: 안 읽은 신규 예약
    if (newA !== newB) return newA ? -1 : 1; 
    
    // 2순위: 취소 요청
    if ((a.status === 'cancellation_requested') !== (b.status === 'cancellation_requested')) return a.status === 'cancellation_requested' ? -1 : 1;
    
    // 3순위: 날짜순
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

// ✅ 기존 승: 마운트 전에는 스켈레톤 (깜빡임 방지)
if (!isMounted) return <Skeleton className="w-full h-96 rounded-3xl" />;

return (
  // 🟢 [수정] 높이 제한(h-[80vh]) 설정하여 스크롤 뚫림 방지
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[80vh] flex flex-col">
      
      {/* 1. 헤더 (제목 + 설명 + 새로고침) */}
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white sticky top-0 z-10">
        <div>
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
            예약 현황
            <button 
              onClick={() => fetchReservations()} 
              className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
              title="새로고침"
            >
              <RefreshCw size={16} className={loading ? "animate-spin text-blue-500" : ""} />
            </button>
          </h3>
          <p className="text-sm text-slate-500 mt-1">게스트의 예약을 관리하고 준비하세요.</p>
        </div>
        
        <div className="flex bg-slate-100 p-1.5 rounded-xl">
          {[
            { id: 'upcoming', label: '다가오는 일정' },
            { id: 'completed', label: '지난 일정' },
            { id: 'cancelled', label: '취소/환불' }
          ].map(tab => {
             // 1. 취소 요청 건수 (주황색)
             const cancelCount = (tab.id === 'cancelled' || tab.id === 'upcoming') 
               ? reservations.filter(r => r.status === 'cancellation_requested').length : 0;
             
             // 🟢 2. [추가] 해당 탭에 '새로운 예약(24시간 내)'이 있는지 확인 (빨간색 N)
             const hasNew = reservations.some(r => {
                const isTabMatch = 
                  tab.id === 'upcoming' ? ['PAID', 'confirmed'].includes(r.status) :
                  tab.id === 'completed' ? r.status === 'completed' :
                  tab.id === 'cancelled' ? ['cancelled', 'cancellation_requested'].includes(r.status) : true;
                
                // isNew 함수 활용 (기존에 정의된 함수)
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
                 {tab.label}
                 
                 {/* 기존: 취소 요청 카운트 */}
                 {cancelCount > 0 && <span className="bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{cancelCount}</span>}
                 
                 {/* 🟢 [추가] 빨간색 N 뱃지 (우측 상단) */}
                 {hasNew && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white ring-2 ring-white shadow-sm">
                      N
                    </span>
                 )}
               </button>
             );
          })}
        </div>
      </div>

      {/* 2. 에러 UI */}
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
  // 🟢 [수정] label 속성 제거 -> title과 subtitle로 변경 (타입 에러 해결)
  <EmptyState 
    title="예약 내역이 없습니다."
    subtitle={activeTab === 'upcoming' 
      ? "매력적인 체험을 등록하고 첫 손님을 맞이해보세요!" 
      : "해당하는 예약 내역이 없습니다."}
  />
) : (
          <div className="space-y-4">
            {filteredList.map(res => (
              <ReservationCard 
                key={res.id}
                res={res}
                isNew={isNew(res.created_at, res.id)}
                isProcessing={processingId === res.id}
                // 모든 핸들러 전달
                onApproveCancel={() => handleApproveCancel(res)}
                onShowProfile={() => setSelectedGuest(res.guest)}
                onCheck={() => markAsRead(res.id)}
                onMessage={() => router.push(`/host/dashboard?tab=inquiries&guestId=${res.user_id}`)}
                onCalendar={() => addToGoogleCalendar(res)}
                onCancelQuery={() => handleRequestUserCancel(res)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedGuest && (
        <GuestProfileModal guest={selectedGuest} onClose={() => setSelectedGuest(null)} />
      )}
    </div>
  );
}