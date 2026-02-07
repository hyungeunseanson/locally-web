'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, Clock, User, CheckCircle2, XCircle, MessageSquare, 
  MoreHorizontal, Loader2, AlertTriangle, RefreshCw, X, AlertCircle
} from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import Link from 'next/link';
import { sendNotification } from '@/app/utils/notification';

export default function ReservationManager() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  
  const supabase = createClient();

  const secureUrl = (url: string | null) => {
    if (!url) return null;
    return url.replace('http://', 'https://');
  };

  const fetchReservations = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          experiences!inner ( id, title, host_id ),
          guest:profiles!bookings_user_id_fkey ( id, full_name, avatar_url, email, phone )
        `)
        .eq('experiences.host_id', user.id)
        .order('created_at', { ascending: false }); // ✅ 최신 예약순 정렬

      if (error) throw error;
      setReservations(data || []);

    } catch (error: any) {
      console.error('예약 로딩 실패:', error);
      if (error.code === 'PGRST200' || error.message.includes('foreign key')) {
        setErrorMsg('데이터베이스 연결 설정이 필요합니다. 관리자에게 문의하세요.');
      } else {
        setErrorMsg('예약 정보를 불러오지 못했습니다.');
      }
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

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

      // 🔔 알림 발송 로직
      await sendNotification({
        supabase,
        userId: booking.user_id,
        type: 'cancellation_approved',
        title: '취소 요청 승인됨',
        message: `'${booking.experiences?.title}' 예약 취소가 승인되었습니다. 환불이 진행됩니다.`,
        link: '/guest/trips'
      });

      alert('환불 처리가 완료되었습니다.');
      fetchReservations(); 

    } catch (err: any) {
      alert(`처리 실패: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const getFilteredList = () => {
    const today = new Date();
    today.setHours(0,0,0,0); // 오늘 00:00:00

    return reservations.filter(r => {
      // ✅ 날짜 비교 로직 수정 (문자열 -> Date 객체 -> 타임스탬프 비교)
      // r.date가 'YYYY-MM-DD' 형식이면 로컬 시간 00:00으로 해석되도록 파싱
      const [year, month, day] = r.date.split('-').map(Number);
      const tripDate = new Date(year, month - 1, day); 
      
      const isCancelled = r.status === 'cancelled'; 
      const isRequesting = r.status === 'cancellation_requested';
      
      if (activeTab === 'cancelled') return isCancelled || isRequesting;
      if (isCancelled) return false; 

      if (activeTab === 'upcoming') {
         // 미래 예약이거나 오늘 예약인 경우
         return tripDate >= today || isRequesting;
      }
      if (activeTab === 'completed') return tripDate < today && !isRequesting;
      
      return true;
    });
  };

  const filteredList = getFilteredList();

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
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          📅 예약 관리
          <button onClick={fetchReservations} className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 transition-colors" title="새로고침">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </h3>
        
        <div className="flex bg-slate-200/50 p-1 rounded-xl">
          {[
            { id: 'upcoming', label: '예정/요청' },
            { id: 'completed', label: '완료됨' },
            { id: 'cancelled', label: '취소/환불' }
          ].map(tab => {
            const count = tab.id === 'cancelled' || tab.id === 'upcoming'
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
                {(tab.id === 'cancelled' || tab.id === 'upcoming') && count > 0 && (
                  <span className="bg-orange-500 text-white text-[10px] px-1.5 rounded-full">{count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 text-red-600 text-sm font-bold flex items-center gap-2 border-b border-red-100">
          <AlertCircle size={18}/> {errorMsg}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <Loader2 className="animate-spin mb-2" size={24}/>
            <p className="text-xs">데이터를 불러오는 중...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
            <Calendar size={40} className="mb-3 opacity-20"/>
            <p className="text-sm font-medium">예약 내역이 없습니다.</p>
          </div>
        ) : (
          filteredList.map(res => (
            <div key={res.id} className={`border rounded-xl p-5 transition-all bg-white shadow-sm ${res.status === 'cancellation_requested' ? 'border-orange-200 bg-orange-50/30' : 'border-slate-100 hover:border-slate-300'}`}>
              
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center text-slate-400">
                    {res.guest?.avatar_url ? (
                      <img src={secureUrl(res.guest.avatar_url)!} className="w-full h-full object-cover" alt="Guest" />
                    ) : (
                      <User size={20}/>
                    )}
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
                
                <Link href={`/host/dashboard?tab=inquiries&guestId=${res.user_id}`}>
                    <button className="text-slate-400 hover:text-black p-2 rounded-full hover:bg-slate-100 transition-colors" title="메시지 보내기">
                        <MessageSquare size={18}/>
                    </button>
                </Link>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg mb-4 border border-slate-100">
                <div className="font-bold text-sm text-slate-800 mb-2 truncate">{res.experiences?.title}</div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><Calendar size={14}/> {new Date(res.date).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1.5"><Clock size={14}/> {res.time || '시간 미정'}</span>
                </div>
              </div>

              {res.status === 'cancellation_requested' && (
                <div className="bg-white border border-orange-100 rounded-lg p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-start gap-3 mb-3">
                    <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={16} />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-orange-800">취소 요청이 접수되었습니다.</p>
                      <p className="text-xs text-orange-600 mt-1">승인 시 전액 환불됩니다.</p>
                      
                      {res.cancel_reason && (
                        <div className="mt-2 bg-orange-50 p-2 rounded border border-orange-100">
                           <p className="text-xs font-bold text-orange-800 mb-1">게스트 사유:</p>
                           <p className="text-xs text-orange-700 break-words whitespace-pre-wrap">
                             {res.cancel_reason}
                           </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={() => handleApproveCancellation(res)}
                      disabled={processingId === res.id}
                      className="flex-1 bg-orange-600 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2 shadow-sm shadow-orange-200"
                    >
                      {processingId === res.id ? <Loader2 className="animate-spin" size={16}/> : <CheckCircle2 size={16}/>}
                      승인 및 환불
                    </button>
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