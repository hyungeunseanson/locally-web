'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, Clock, User, CheckCircle2, XCircle, MessageSquare, 
  MoreHorizontal, Loader2, AlertTriangle, RefreshCw, X
} from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import Link from 'next/link';

export default function ReservationManager() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  
  const supabase = createClient();

  // 1. 예약 데이터 불러오기
  const fetchReservations = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 내 체험(experiences)에 걸린 예약(bookings) 조회
      // !inner를 사용하여 내 host_id와 일치하는 체험의 예약만 가져옴
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          experiences!inner ( id, title, host_id ),
          guest:profiles!bookings_user_id_fkey ( id, full_name, avatar_url, email, phone )
        `)
        .eq('experiences.host_id', user.id)
        .order('date', { ascending: false }); // 최신순 정렬

      if (error) throw error;
      setReservations(data || []);

    } catch (error) {
      console.error('예약 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // 2. 취소 요청 승인 (환불 처리)
  const handleApproveCancellation = async (booking: any) => {
    if (!confirm(`'${booking.guest.full_name}' 님의 취소 요청을 승인하시겠습니까?\n승인 즉시 환불이 진행됩니다.`)) return;

    setProcessingId(booking.id);
    try {
      // 서버의 환불 API 호출
      const res = await fetch('/api/payment/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bookingId: booking.id, 
          reason: '호스트가 취소 요청 승인' 
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || '환불 실패');

      alert('취소가 승인되고 환불되었습니다.');
      fetchReservations(); // 목록 갱신

    } catch (err: any) {
      alert(`처리 실패: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  // 3. 필터링 로직
  const getFilteredList = () => {
    const today = new Date().setHours(0,0,0,0);

    return reservations.filter(r => {
      const tripDate = new Date(r.date).getTime();
      const isCancellation = r.status === 'cancelled' || r.status === 'cancellation_requested';
      
      if (activeTab === 'cancelled') return isCancellation;
      if (isCancellation) return false; // 다른 탭에서는 취소건 제외

      if (activeTab === 'upcoming') return tripDate >= today;
      if (activeTab === 'completed') return tripDate < today;
      
      return true;
    });
  };

  const filteredList = getFilteredList();

  // 4. 상태 뱃지 렌더링
  const renderStatusBadge = (status: string, date: string) => {
    if (status === 'cancellation_requested') return <span className="bg-orange-100 text-orange-700 text-[10px] px-2 py-1 rounded-full font-bold animate-pulse">취소 요청됨</span>;
    if (status === 'cancelled') return <span className="bg-red-100 text-red-700 text-[10px] px-2 py-1 rounded-full font-bold">취소 완료</span>;
    if (status === 'PAID') {
      const isUpcoming = new Date(date) >= new Date();
      return isUpcoming 
        ? <span className="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded-full font-bold">예약 확정</span>
        : <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-1 rounded-full font-bold">이용 완료</span>;
    }
    return <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-1 rounded-full">{status}</span>;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
      {/* 헤더 & 탭 */}
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          📅 예약 관리
          <button onClick={fetchReservations} className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 transition-colors">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </h3>
        
        <div className="flex bg-slate-200/50 p-1 rounded-xl">
          {[
            { id: 'upcoming', label: '예정된 일정' },
            { id: 'completed', label: '완료됨' },
            { id: 'cancelled', label: '취소/환불' }
          ].map(tab => {
            // 취소 요청 건수 카운트
            const count = tab.id === 'cancelled' 
              ? reservations.filter(r => r.status === 'cancellation_requested').length 
              : 0;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === tab.id 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                {tab.label}
                {count > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{count}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* 리스트 영역 */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <Loader2 className="animate-spin mb-2" size={24}/>
            <p className="text-xs">데이터를 불러오는 중...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
            <Calendar size={40} className="mb-3 opacity-20"/>
            <p className="text-sm font-medium">해당하는 예약 내역이 없습니다.</p>
          </div>
        ) : (
          filteredList.map(res => (
            <div key={res.id} className={`border rounded-xl p-5 transition-all bg-white shadow-sm ${res.status === 'cancellation_requested' ? 'border-orange-200 bg-orange-50/30' : 'border-slate-100 hover:border-slate-300'}`}>
              
              {/* 상단: 게스트 & 상태 정보 */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center text-slate-400">
                    {res.guest?.avatar_url ? <img src={res.guest.avatar_url} className="w-full h-full object-cover"/> : <User size={20}/>}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-slate-900 text-sm">{res.guest?.full_name || '게스트'}</span>
                      {renderStatusBadge(res.status, res.date)}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span>{res.guests}명</span>
                      <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                      <span>₩{res.amount?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                
                {/* 메시지 버튼 */}
                <Link href={`/host/dashboard?tab=inquiries&guestId=${res.user_id}`}>
                    <button className="text-slate-400 hover:text-black p-2 rounded-full hover:bg-slate-100 transition-colors" title="메시지 보내기">
                        <MessageSquare size={18}/>
                    </button>
                </Link>
              </div>

              {/* 체험 정보 */}
              <div className="bg-slate-50 p-3 rounded-lg mb-4 border border-slate-100">
                <div className="font-bold text-sm text-slate-800 mb-2 truncate">{res.experiences?.title}</div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><Calendar size={14}/> {new Date(res.date).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1.5"><Clock size={14}/> {res.time || '시간 미정'}</span>
                </div>
              </div>

              {/* 🚨 취소 요청 처리 버튼 (취소 요청 상태일 때만 표시) */}
              {res.status === 'cancellation_requested' && (
                <div className="bg-white border border-orange-100 rounded-lg p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-start gap-3 mb-3">
                    <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={16} />
                    <div>
                      <p className="text-sm font-bold text-orange-800">취소 요청이 접수되었습니다.</p>
                      <p className="text-xs text-orange-600 mt-1">승인 시 결제가 자동으로 취소되고 전액 환불됩니다.</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleApproveCancellation(res)}
                      disabled={processingId === res.id}
                      className="flex-1 bg-orange-600 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2 shadow-sm shadow-orange-200"
                    >
                      {processingId === res.id ? <Loader2 className="animate-spin" size={16}/> : <CheckCircle2 size={16}/>}
                      취소 승인 및 환불
                    </button>
                    {/* 거절 버튼은 추후 구현 (일단 비활성화 or 숨김) */}
                    {/* <button className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-lg text-sm font-bold hover:bg-slate-50">거절</button> */}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}