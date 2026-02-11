'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, Clock, User, CheckCircle2, MessageSquare, 
  RefreshCw, AlertCircle, Phone, Mail, XCircle, AlertTriangle, Loader2, 
  CalendarPlus // 👈 [추가] 콤마(,) 잊지 마세요!
} from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sendNotification } from '@/app/utils/notification';
import Skeleton from '@/app/components/ui/Skeleton';
import EmptyState from '@/app/components/EmptyState';
import { useToast } from '@/app/context/ToastContext';

export default function ReservationManager() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null); // ✅ 에러 메시지 복구
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<any>(null); // ✅ 추가: 선택된 게스트 정보 저장
  
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  const secureUrl = (url: string | null) => {
    if (!url) return null;
    return url.replace('http://', 'https://');
  };

  const getDDay = (dateString: string) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const target = new Date(dateString);
    const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diff < 0) return '종료';
    if (diff === 0) return 'Today';
    return `D-${diff}`;
  };

  // ✅ [수정] 신규 예약 판별 함수 (이거 하나만 있으면 됩니다)
  const isNewReservation = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    const now = new Date().getTime();
    return (now - created) / (1000 * 60 * 60) < 24; 
  };
// ✅ [추가] 구글 캘린더 일정 등록 함수
const addToGoogleCalendar = (res: any) => {
  const title = encodeURIComponent(`[Locally] ${res.experiences?.title} - ${res.guest?.full_name}님`);
  const details = encodeURIComponent(`예약 번호: #${String(res.id)}\n게스트: ${res.guest?.full_name} (${res.guests}명)\n연락처: ${res.guest?.phone || '없음'}`);
  
  // 날짜/시간 파싱 (ISO 포맷 변환)
  const startDate = new Date(`${res.date}T${res.time || '00:00:00'}`);
  const endDate = new Date(startDate.getTime() + (2 * 60 * 60 * 1000)); // 기본 2시간으로 설정
  
  const formatTime = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, "");
  const dates = `${formatTime(startDate)}/${formatTime(endDate)}`;
  
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}`;
  window.open(url, '_blank');
};
  const fetchReservations = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null); // 초기화
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
      `) // 👈 설명글 없이 이렇게 깔끔해야 합니다.
      .eq('experiences.host_id', user.id)
      .order('date', { ascending: true });

      if (error) throw error;
      setReservations(data || []);

    } catch (error: any) {
      console.error('예약 로딩 실패:', error);
      setErrorMsg('예약 정보를 불러오는데 실패했습니다.'); // ✅ 에러 상태 저장
      showToast('예약 정보를 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }, [supabase]);


// 2. 실시간 예약 감지 (새 예약 들어오면 알림 + 새로고침)
useEffect(() => {
  fetchReservations();

  const channel = supabase
    .channel('host-bookings')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'bookings' },
      (payload) => {
        console.log('예약 변경 감지됨!', payload);
        fetchReservations();
        
        if (payload.eventType === 'INSERT') {
           showToast('🎉 새로운 예약이 도착했습니다!', 'success');
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
      fetchReservations(); 

    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const getFilteredList = () => {
    const today = new Date();
    today.setHours(0,0,0,0);

    // 1. 탭에 맞춰서 일단 거르기
    let filtered = reservations.filter(r => {
      const [year, month, day] = r.date.split('-').map(Number);
      const tripDate = new Date(year, month - 1, day); 
      const isCancelled = r.status === 'cancelled'; 
      const isRequesting = r.status === 'cancellation_requested';
      
      if (activeTab === 'cancelled') return isCancelled || isRequesting;
      if (isCancelled) return false; 
      if (activeTab === 'upcoming') return tripDate >= today || isRequesting;
      if (activeTab === 'completed') return tripDate < today && !isRequesting;
      return true;
    });

    // 2. 정렬하기 (신규 예약 우선 -> 그 다음 날짜순)
    return filtered.sort((a, b) => {
      const aNew = isNewReservation(a.created_at);
      const bNew = isNewReservation(b.created_at);

      // 신규 예약(24시간 내)이 무조건 위로
      if (aNew && !bNew) return -1;
      if (!aNew && bNew) return 1;

      // 그 다음은 여행 날짜(date) 빠른 순서
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  };

  const filteredList = getFilteredList();

  // ✅ [복구] 상태 뱃지 렌더링 함수 (디자인 업그레이드)
  const renderStatusBadge = (status: string, date: string) => {
    const isPast = new Date(date) < new Date();
    
    if (status === 'cancellation_requested') 
      return <span className="bg-orange-100 text-orange-700 text-[10px] px-2 py-1 rounded-full font-bold animate-pulse flex items-center gap-1"><AlertTriangle size={10}/> 취소 요청됨</span>;
    if (status === 'cancelled') 
      return <span className="bg-red-100 text-red-700 text-[10px] px-2 py-1 rounded-full font-bold">취소 완료</span>;
    if (status === 'PAID' || status === 'confirmed') {
      return isPast 
        ? <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-1 rounded-full font-bold">이용 완료</span>
        : <span className="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1"><CheckCircle2 size={10}/> 예약 확정</span>;
    }
    return <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-1 rounded-full">{status}</span>;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white">
        <div>
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
            예약 현황
            <button onClick={fetchReservations} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
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

      {/* ✅ [복구] 에러 메시지 UI */}
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
            {filteredList.map(res => {
              const dDay = getDDay(res.date);
              const isConfirmed = res.status === 'confirmed' || res.status === 'PAID';
              const isNew = isNewReservation(res.created_at);

              return (
                <div key={res.id} className={`bg-white rounded-2xl p-6 border transition-all relative overflow-hidden group ${
                  isNew ? 'border-rose-200 shadow-md ring-1 ring-rose-100' : 'border-slate-200 shadow-sm hover:shadow-md'
                }`}>
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                    res.status === 'cancellation_requested' ? 'bg-orange-400 animate-pulse' :
                    isConfirmed ? 'bg-green-500' : 
                    res.status === 'cancelled' ? 'bg-red-400' : 'bg-slate-300'
                  }`}/>

                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="md:w-32 flex-shrink-0 flex flex-col items-center justify-center bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full mb-2 ${
                        dDay === 'Today' ? 'bg-rose-100 text-rose-600' : 
                        isConfirmed ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {dDay}
                      </span>
                      <div className="text-2xl font-black text-slate-900">{new Date(res.date).getDate()}</div>
                      <div className="text-sm font-bold text-slate-500 uppercase">
                        {new Date(res.date).toLocaleString('en-US', { month: 'short' })}
                      </div>
                      <div className="mt-2 text-xs font-medium text-slate-400 flex items-center gap-1">
                        <Clock size={12}/> {res.time}
                      </div>
                      {isConfirmed && (
                        <button 
                          onClick={() => addToGoogleCalendar(res)}
                          className="mt-3 w-full text-[10px] bg-white border border-slate-200 py-1.5 rounded-lg flex items-center justify-center gap-1 hover:bg-slate-100 hover:text-blue-600 transition-colors"
                          title="구글 캘린더에 추가"
                        >
                          <CalendarPlus size={12}/> 일정 추가
                        </button>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-xs font-bold text-slate-400 mb-1">{res.experiences?.title}</p>
                          <div className="flex items-center gap-2">
                             <h4 className="text-lg font-bold text-slate-900">예약 #{String(res.id).slice(0, 8)}</h4>
                             {isNew && (
                               <span className="bg-rose-600 text-white text-[10px] px-1.5 py-0.5 rounded-md font-black animate-pulse">N</span>
                             )}
                             {renderStatusBadge(res.status, res.date)}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400 font-bold mb-1">예상 수입</p>
                          <p className="text-xl font-black text-slate-900">₩{res.amount?.toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row gap-6">
                        <div 
                          className="flex items-center gap-4 cursor-pointer group/profile"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedGuest(res.guest);
                          }}
                        >
                          <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden border border-slate-200 group-hover/profile:ring-2 ring-slate-900 transition-all">
                            {res.guest?.avatar_url ? (
                              <img src={secureUrl(res.guest.avatar_url)!} className="w-full h-full object-cover" alt="Guest" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400"><User size={20}/></div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1">
                              <p className="font-bold text-slate-900 group-hover/profile:underline underline-offset-2 decoration-2">{res.guest?.full_name || '게스트'}</p>
                              <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">프로필 보기</span>
                            </div>
                            <p className="text-xs text-slate-500">{res.guests}명 참여</p>
                          </div>
                        </div>

                        {isConfirmed && (
                          <div className="flex flex-col justify-center gap-2 text-sm text-slate-600 border-l border-slate-100 pl-6">
                              {res.guest?.phone && (
                                <div className="flex items-center gap-2 hover:text-black cursor-pointer">
                                  <Phone size={14} className="text-slate-400"/> {res.guest.phone}
                                </div>
                              )}
                              {res.guest?.email && (
                                <div className="flex items-center gap-2 hover:text-black cursor-pointer">
                                  <Mail size={14} className="text-slate-400"/> {res.guest.email}
                                </div>
                              )}
                              {res.guest?.kakao_id && (
                                <div className="flex items-center gap-2 hover:text-yellow-600 cursor-pointer text-slate-600">
                                  <div className="w-3.5 h-3.5 bg-yellow-400 rounded-sm flex items-center justify-center">
                                    <MessageSquare size={8} className="text-yellow-900" fill="currentColor"/>
                                  </div>
                                  {res.guest.kakao_id}
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-row md:flex-col gap-2 justify-center border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 min-w-[140px]">
                      <button 
                        onClick={() => router.push(`/host/dashboard?tab=inquiries&guestId=${res.user_id}`)}
                        className="w-full bg-slate-900 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-black transition-colors flex items-center justify-center gap-2 shadow-sm"
                      >
                        <MessageSquare size={16}/> 메시지
                      </button>
                      
                      {isConfirmed && (
                        <button 
                          onClick={() => handleRequestUserCancel(res)}
                          className="w-full bg-white text-slate-500 border border-slate-200 px-4 py-3 rounded-xl text-sm font-bold hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors flex items-center justify-center gap-2"
                        >
                          <XCircle size={16}/> 취소 문의
                        </button>
                      )}
                    </div>
                  </div>

                  {res.status === 'cancellation_requested' && (
                    <div className="mt-4 bg-orange-50 border border-orange-100 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                       <div className="flex items-start gap-3">
                         <AlertTriangle className="text-orange-500 shrink-0 mt-1" size={20} />
                         <div className="flex-1">
                           <p className="font-bold text-orange-900">취소 요청이 접수되었습니다.</p>
                           <p className="text-sm text-orange-700 mt-1">게스트 사유: {res.cancel_reason || '사유 없음'}</p>
                           <button 
                             onClick={() => handleApproveCancellation(res)}
                             disabled={processingId === res.id}
                             className="mt-3 bg-orange-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-orange-700 transition-colors flex items-center gap-2 shadow-md"
                           >
                             {processingId === res.id ? <Loader2 className="animate-spin" size={16}/> : <CheckCircle2 size={16}/>}
                             요청 승인 및 환불해주기
                           </button>
                         </div>
                       </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedGuest(null)}>
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            
            {/* 닫기 버튼 */}
            <button onClick={() => setSelectedGuest(null)} className="absolute top-4 right-4 z-10 p-2 bg-white/20 backdrop-blur-md hover:bg-white/40 rounded-full text-white transition-colors">
              <XCircle size={24} />
            </button>

            {/* 상단 커버 & 아바타 */}
            <div className="h-32 bg-slate-900 relative">
               <div className="absolute -bottom-12 left-6 p-1 bg-white rounded-full">
                 <div className="w-24 h-24 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                   {selectedGuest.avatar_url ? (
                     <img src={secureUrl(selectedGuest.avatar_url)!} className="w-full h-full object-cover" alt="Guest" />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center text-slate-400"><User size={40}/></div>
                   )}
                 </div>
               </div>
            </div>

            {/* 프로필 내용 */}
            <div className="pt-16 px-6 pb-8">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                {selectedGuest.full_name}
                {selectedGuest.host_nationality && <span className="text-xl">{selectedGuest.host_nationality}</span>}
              </h2>
              <p className="text-sm text-slate-500 font-medium mb-6">
              {(() => {
                if (!selectedGuest.languages) return '언어 정보 없음';
                try {
                  if (Array.isArray(selectedGuest.languages)) return selectedGuest.languages.join(', ');
                  if (selectedGuest.languages.startsWith('[')) return JSON.parse(selectedGuest.languages).join(', ');
                  return selectedGuest.languages;
                } catch (e) {
                  return selectedGuest.languages;
                }
              })()}
              </p>

              {/* 소개글 */}
              <div className="bg-slate-50 p-4 rounded-2xl mb-6">
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {selectedGuest.introduction || "아직 자기소개가 없습니다."}
                </p>
              </div>

              {/* 연락처 정보 (중요!) */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contact Info</h3>
                <div className="grid gap-3">
                  <div className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700">
                      <MessageSquare size={16} fill="currentColor"/> 
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold">KakaoTalk ID</p>
                      <p className="text-sm font-bold text-slate-900">{selectedGuest.kakao_id || '등록되지 않음'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                     <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                       <Phone size={16}/>
                     </div>
                     <div>
                       <p className="text-[10px] text-slate-400 font-bold">Phone Number</p>
                       <p className="text-sm font-bold text-slate-900">{selectedGuest.phone || '비공개'}</p>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}