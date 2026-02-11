'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { sendNotification } from '@/app/utils/notification'; 
import Skeleton from '@/app/components/ui/Skeleton';
import EmptyState from '@/app/components/EmptyState';
import { useToast } from '@/app/context/ToastContext';

// 컴포넌트 불러오기 (파일 분리된 상태 유지)
import ReservationCard from './ReservationCard';
import GuestProfileModal from './GuestProfileModal';

export default function ReservationManager() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<any>(null);
  
  // 확인된 예약 ID 저장
  const [checkedIds, setCheckedIds] = useState<number[]>([]);

  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem('host_checked_reservations');
    if (saved) {
      setCheckedIds(JSON.parse(saved));
    }
  }, []);

  const markAsRead = (id: number) => {
    if (!checkedIds.includes(id)) {
      const newChecked = [...checkedIds, id];
      setCheckedIds(newChecked);
      localStorage.setItem('host_checked_reservations', JSON.stringify(newChecked));
    }
  };

  const isNewReservation = (createdAt: string, id: number) => {
    if (checkedIds.includes(id)) return false; 
    const created = new Date(createdAt).getTime();
    const now = new Date().getTime();
    return (now - created) / (1000 * 60 * 60) < 24; 
  };

  const addToGoogleCalendar = (res: any) => {
    const title = encodeURIComponent(`[Locally] ${res.experiences?.title} - ${res.guest?.full_name}님`);
    const details = encodeURIComponent(`예약 번호: #${String(res.id)}\n게스트: ${res.guest?.full_name} (${res.guests}명)\n연락처: ${res.guest?.phone || '없음'}`);
    const startDate = new Date(`${res.date}T${res.time || '00:00:00'}`);
    const endDate = new Date(startDate.getTime() + (2 * 60 * 60 * 1000));
    const formatTime = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const dates = `${formatTime(startDate)}/${formatTime(endDate)}`;
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}`;
    window.open(url, '_blank');
  };

  // ✅ 데이터 불러오기 (로딩바 없이 조용히 갱신하려면 isLoading=false 옵션 사용 가능)
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
      setReservations(data || []);

    } catch (error: any) {
      console.error('예약 로딩 실패:', error);
      setErrorMsg('예약 정보를 불러오는데 실패했습니다.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [supabase]);

  // ✅ [핵심] 실시간 감지 및 알림/새로고침 로직 강화
  useEffect(() => {
    fetchReservations(); // 초기 로드

    const channel = supabase
      .channel('host-dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        async (payload) => {
          console.log('🔔 예약 테이블 변경 감지:', payload);

          // 1. 데이터 새로고침 (DB 반영 시간을 고려해 약간의 딜레이 후 실행)
          setTimeout(() => fetchReservations(false), 500);

          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          // 2. 상황별 알림 처리
          if (payload.eventType === 'INSERT') {
             // 신규 예약 발생 시
             showToast('🎉 새로운 예약이 도착했습니다!', 'success');
             
             // 알림 스택에 추가
             await sendNotification({
               userId: user.id,
               type: 'new_booking',
               title: '새로운 예약 도착',
               message: '게스트의 새로운 예약이 접수되었습니다.',
               link: '/host/dashboard'
             });
          } 
          else if (payload.eventType === 'UPDATE') {
            const newStatus = payload.new.status;
            const oldStatus = payload.old.status;

            // 취소 요청이 들어왔을 때
            if (newStatus === 'cancellation_requested' && oldStatus !== 'cancellation_requested') {
              showToast('🚨 예약 취소 요청이 접수되었습니다.', 'error');
              
              await sendNotification({
                userId: user.id,
                type: 'booking_cancel_request',
                title: '예약 취소 요청',
                message: '게스트가 예약을 취소하고 싶어합니다. 확인해주세요.',
                link: '/host/dashboard?tab=cancelled' // 취소 탭으로 유도
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchReservations, supabase]);

  const handleRequestUserCancel = (res: any) => {
    const confirmMessage = 
      `🚨 예약 취소 문의\n\n` +
      `게스트에게 직접 취소를 요청하시겠습니까?\n` +
      `'확인'을 누르면 해당 게스트와의 채팅방으로 이동합니다.`;

    if (confirm(confirmMessage)) {
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
        body: JSON.stringify({ 
          bookingId: booking.id, 
          reason: '호스트 승인에 의한 환불' 
        }),
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
      // 0.5초 뒤 목록 갱신
      setTimeout(() => fetchReservations(), 500);

    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const getFilteredList = () => {
    const today = new Date();
    today.setHours(0,0,0,0);

    let filtered = reservations.filter(r => {
      const [year, month, day] = r.date.split('-').map(Number);
      const tripDate = new Date(year, month - 1, day); 
      const isCancelled = r.status === 'cancelled'; 
      const isRequesting = r.status === 'cancellation_requested'; // 취소 요청 상태
      
      if (activeTab === 'cancelled') return isCancelled || isRequesting;
      if (isCancelled) return false; 
      
      // ✅ [수정] 다가오는 일정 탭에 '취소 요청' 상태도 포함시켜서 보이게 함
      if (activeTab === 'upcoming') return tripDate >= today || isRequesting;
      if (activeTab === 'completed') return tripDate < today && !isRequesting;
      return true;
    });

    return filtered.sort((a, b) => {
      const aNew = isNewReservation(a.created_at, a.id);
      const bNew = isNewReservation(b.created_at, b.id);
      
      // 1. 신규 예약 우선
      if (aNew && !bNew) return -1;
      if (!aNew && bNew) return 1;
      
      // 2. 취소 요청된 건 우선 노출 (호스트가 빨리 봐야 하므로)
      const aReq = a.status === 'cancellation_requested';
      const bReq = b.status === 'cancellation_requested';
      if (aReq && !bReq) return -1;
      if (!aReq && bReq) return 1;

      // 3. 날짜순
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  };

  const filteredList = getFilteredList();

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
        
        <div className="flex bg-slate-100 p-1.5 rounded-xl">
          {[
            { id: 'upcoming', label: '다가오는 일정' },
            { id: 'completed', label: '지난 일정' },
            { id: 'cancelled', label: '취소/환불' }
          ].map(tab => {
            const count = tab.id === 'cancelled' || tab.id === 'upcoming'
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
                {(tab.id === 'cancelled' || tab.id === 'upcoming') && count > 0 && (
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