'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { sendNotification } from '@/app/utils/notification'; 
import Skeleton from '@/app/components/ui/Skeleton';
import EmptyState from '@/app/components/EmptyState';
import { useToast } from '@/app/context/ToastContext';

// 컴포넌트 불러오기
import ReservationCard from './ReservationCard';
import GuestProfileModal from './GuestProfileModal';

export default function ReservationManager() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [reservations, setReservations] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false); // ✅ 마운트 상태
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<any>(null);
  
  // 확인된 예약 ID 저장
  const [checkedIds, setCheckedIds] = useState<number[]>([]);

  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  // 1️⃣ 초기화: 마운트 상태 및 로컬 스토리지 로드
  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('host_checked_reservations');
    if (saved) {
      setCheckedIds(JSON.parse(saved));
    }
  }, []);

  // 2️⃣ 데이터 불러오기 함수
  const fetchReservations = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setErrorMsg(null);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        experiences!inner ( id, title, host_id ),
        guest:profiles!bookings_user_id_fkey ( 
          id, full_name, avatar_url, email, phone, 
          kakao_id, introduction, job, languages, host_nationality 
        )
      `)
      .eq('experiences.host_id', user.id);

      if (error) throw error;
      
      console.log('✅ 예약 데이터 로드 성공:', data); // 디버깅용 로그
      setReservations(data || []);

    } catch (error: any) {
      console.error('❌ 예약 로딩 실패:', error);
      setErrorMsg('예약 정보를 불러오는데 실패했습니다.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [supabase]);

  // 3️⃣ 최초 실행 및 탭 변경 시 데이터 로드
  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]); // activeTab이 바뀌어도 데이터는 그대로 두고 필터링만 다시 하면 되므로 의존성 제거

  // 4️⃣ 실시간 감지 (알림 및 자동 갱신)
  useEffect(() => {
    const channel = supabase
      .channel('host-dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        async (payload) => {
          console.log('🔔 실시간 변경 감지:', payload);
          
          // 데이터 갱신 (딜레이 없이 바로 시도하되, 0.5초 뒤 한번 더 확인)
          fetchReservations(false);
          setTimeout(() => fetchReservations(false), 500);

          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          if (payload.eventType === 'INSERT') {
             showToast('🎉 새로운 예약이 도착했습니다!', 'success');
             await sendNotification({
               userId: user.id,
               type: 'new_booking',
               title: '새로운 예약 도착',
               message: '새로운 예약이 접수되었습니다. 확인해보세요!',
               link: '/host/dashboard'
             });
          } 
          else if (payload.eventType === 'UPDATE') {
            const newStatus = payload.new.status;
            const oldStatus = payload.old.status;

            if (newStatus === 'cancellation_requested' && oldStatus !== 'cancellation_requested') {
              showToast('🚨 예약 취소 요청이 접수되었습니다.', 'error');
              await sendNotification({
                userId: user.id,
                type: 'booking_cancel_request',
                title: '예약 취소 요청',
                message: '게스트가 예약을 취소하고 싶어합니다. 확인해주세요.',
                link: '/host/dashboard?tab=cancelled'
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchReservations, supabase, showToast]);

  // 예약 확인 처리
  const markAsRead = (id: number) => {
    if (!checkedIds.includes(id)) {
      const newChecked = [...checkedIds, id];
      setCheckedIds(newChecked);
      localStorage.setItem('host_checked_reservations', JSON.stringify(newChecked));
    }
  };

  // 신규 예약 배지 로직 (마운트 전에는 false 처리하여 하이드레이션 에러 방지)
  const isNewReservation = (createdAt: string, id: number) => {
    if (!isMounted) return false; 
    if (checkedIds.includes(id)) return false; 
    const created = new Date(createdAt).getTime();
    const now = new Date().getTime();
    return (now - created) / (1000 * 60 * 60) < 24; 
  };

  // 액션 핸들러들
  const addToGoogleCalendar = (res: any) => {
    const title = encodeURIComponent(`[Locally] ${res.experiences?.title} - ${res.guest?.full_name}님`);
    const details = encodeURIComponent(`예약 번호: #${String(res.id)}\n게스트: ${res.guest?.full_name} (${res.guests}명)\n연락처: ${res.guest?.phone || '없음'}`);
    const startDate = new Date(`${res.date}T${res.time || '00:00:00'}`);
    const endDate = new Date(startDate.getTime() + (2 * 60 * 60 * 1000));
    const formatTime = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const dates = `${formatTime(startDate)}/${formatTime(endDate)}`;
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}`, '_blank');
  };

  const handleRequestUserCancel = (res: any) => {
    if (confirm(`🚨 예약 취소 문의\n\n게스트에게 직접 취소를 요청하시겠습니까?\n'확인'을 누르면 해당 게스트와의 채팅방으로 이동합니다.`)) {
      router.push(`/host/dashboard?tab=inquiries&guestId=${res.user_id}`);
    }
  };

  const handleApproveCancellation = async (booking: any) => {
    if (!confirm(`'${booking.guest?.full_name}' 님의 취소를 승인하고 환불하시겠습니까?`)) return;

    setProcessingId(booking.id);
    try {
      const res = await fetch('/api/payment/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id, reason: '호스트 승인에 의한 환불' }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || '환불 실패');

      await sendNotification({
        userId: booking.user_id,
        type: 'cancellation_approved',
        title: '취소 요청 승인됨',
        message: `'${booking.experiences?.title}' 예약 취소가 승인되었습니다. 환불이 진행됩니다.`,
        link: '/guest/trips'
      });

      showToast('취소가 승인되고 환불 처리되었습니다.');
      setTimeout(() => fetchReservations(false), 500); // 목록 갱신

    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // 5️⃣ 필터링 로직 (상태별 분류)
  const getFilteredList = () => {
    const today = new Date();
    today.setHours(0,0,0,0);

    let filtered = reservations.filter(r => {
      const [year, month, day] = r.date.split('-').map(Number);
      const tripDate = new Date(year, month - 1, day); 
      const isCancelled = r.status === 'cancelled'; 
      const isRequesting = r.status === 'cancellation_requested';
      
      // 탭별 필터링
      if (activeTab === 'cancelled') return isCancelled || isRequesting;
      if (isCancelled) return false; // 취소된 건 다른 탭에 안 보이게
      
      // '다가오는 일정'에는 미래 예약 + 취소 요청 건 포함
      if (activeTab === 'upcoming') return tripDate >= today || isRequesting;
      
      // '완료된 일정'에는 과거 예약만
      if (activeTab === 'completed') return tripDate < today && !isRequesting;
      
      return true;
    });

    // 정렬 (신규 -> 취소요청 -> 날짜순)
    return filtered.sort((a, b) => {
      const aNew = isNewReservation(a.created_at, a.id);
      const bNew = isNewReservation(b.created_at, b.id);
      
      if (aNew && !bNew) return -1;
      if (!aNew && bNew) return 1;
      
      const aReq = a.status === 'cancellation_requested';
      const bReq = b.status === 'cancellation_requested';
      if (aReq && !bReq) return -1;
      if (!aReq && bReq) return 1;

      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  };

  const filteredList = getFilteredList();

  // 🚨 [중요] 마운트 전에는 스켈레톤, 마운트 후에는 실제 데이터 렌더링
  if (!isMounted) return <Skeleton className="w-full h-64 rounded-2xl" />;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white">
        <div>
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
            예약 현황
            <button onClick={() => fetchReservations()} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </h3>
          <p className="text-sm text-slate-500 mt-1">게스트의 예약을 관리하고 준비하세요.</p>
        </div>
        
        {/* 탭 버튼 */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl">
          {[
            { id: 'upcoming', label: '다가오는 일정' },
            { id: 'completed', label: '지난 일정' },
            { id: 'cancelled', label: '취소/환불' }
          ].map(tab => {
            // 알림 뱃지 카운트 (취소 요청 건수)
            const count = (tab.id === 'cancelled' || tab.id === 'upcoming')
              ? reservations.filter(r => r.status === 'cancellation_requested').length 
              : 0;
              
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === tab.id 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className="bg-orange-500 text-white text-[10px] px-1.5 rounded-full">{count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {errorMsg && (
        <div className="mx-6 mt-4 p-4 bg-red-50 text-red-600 text-sm font-bold flex items-center gap-2 border border-red-100 rounded-xl">
          <AlertCircle size={18}/> {errorMsg}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border rounded-2xl p-6 bg-white space-y-4">
                <div className="flex gap-4">
                  <Skeleton className="w-24 h-24 rounded-xl" />
                  <div className="space-y-3 flex-1">
                    <Skeleton className="w-1/3 h-5" />
                    <Skeleton className="w-1/4 h-4" />
                    <Skeleton className="w-full h-10 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredList.length === 0 ? (
          <EmptyState 
            title="예약 내역이 없습니다." 
            subtitle={activeTab === 'upcoming' ? "매력적인 체험을 등록하고 첫 손님을 맞이해보세요!" : "내역이 없습니다."}
          />
        ) : (
          <div className="space-y-6">
            {filteredList.map(res => (
              <ReservationCard 
                key={res.id}
                res={res}
                isNew={isNewReservation(res.created_at, res.id)} 
                processingId={processingId}
                onCalendar={addToGoogleCalendar}
                onMessage={(userId) => router.push(`/host/dashboard?tab=inquiries&guestId=${userId}`)}
                onCancelQuery={handleRequestUserCancel}
                onApproveCancel={handleApproveCancellation}
                onShowProfile={setSelectedGuest}
                onCheck={markAsRead} 
              />
            ))}
          </div>
        )}
      </div>

      <GuestProfileModal 
        guest={selectedGuest} 
        onClose={() => setSelectedGuest(null)} 
      />
    </div>
  );
}