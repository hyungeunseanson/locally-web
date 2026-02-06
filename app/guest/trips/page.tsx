'use client';

import React, { useEffect, useState } from 'react';
import { 
  Calendar, MapPin, MoreHorizontal, MessageSquare, Receipt, Ghost, Lock, Loader2, X, Share2, Map, Clock
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import ReviewModal from '@/app/components/ReviewModal';

export default function GuestTripsPage() {
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [upcomingTrips, setUpcomingTrips] = useState<any[]>([]);
  const [pastTrips, setPastTrips] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 모달 상태
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<any>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchMyTrips();
  }, []);

  const fetchMyTrips = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 🚨 수정: 에러가 나던 복잡한 profiles 연결을 빼고, 체험 정보만 안전하게 가져옵니다.
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          *,
          experiences (
            id, title, city, photos, address, host_id
          )
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: true });

      if (error) throw error;

      if (bookings) {
        const upcoming: any[] = [];
        const past: any[] = [];

        bookings.forEach((booking: any) => {
          const tripDate = new Date(booking.date);
          const today = new Date();
          today.setHours(0,0,0,0);
          
          const isFuture = tripDate >= today && booking.status !== 'cancelled';
          
          const diffTime = tripDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          const dDay = isFuture ? (diffDays === 0 ? 'D-Day' : `D-${diffDays}`) : null;

          const formattedTrip = {
            id: booking.id,
            title: booking.experiences?.title || '체험 정보 불러오는 중',
            hostName: 'Locally Host', // 호스트 이름 연결 에러 방지를 위해 고정값 사용
            hostId: booking.experiences?.host_id,
            date: booking.date, 
            time: booking.time || '시간 미정',
            location: booking.experiences?.city || '장소 정보 없음',
            address: booking.experiences?.address || '상세 주소 정보 없음', 
            image: booking.experiences?.photos?.[0],
            dDay: dDay,
            isPrivate: booking.type === 'private',
            status: booking.status,
            price: booking.amount || booking.total_price || 0,
            guests: booking.guests || 1,
            expId: booking.experience_id,
            orderId: booking.order_id || `ORD-${booking.id.substring(0,6).toUpperCase()}`,
          };

          if (isFuture) {
            upcoming.push(formattedTrip);
          } else {
            past.push(formattedTrip);
          }
        });

        setUpcomingTrips(upcoming);
        setPastTrips(past.reverse());
      }
    } catch (err) {
      console.error('데이터 로딩 실패:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 예약 취소
  const handleCancelBooking = async (id: number) => {
    if (!confirm('정말 예약을 취소하시겠습니까?')) return;
    
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
    if (!error) {
      alert('예약이 취소되었습니다.');
      fetchMyTrips(); 
    } else {
      alert('취소 실패: ' + error.message);
    }
  };

  // 모달 핸들러
  const handleOpenReceipt = (trip: any) => { setSelectedTrip(trip); setIsReceiptModalOpen(true); };
  const handleOpenReview = (trip: any) => { setSelectedTrip(trip); setIsReviewModalOpen(true); };

  // 기능: 캘린더 추가
  const addToCalendar = (trip: any) => {
    const text = encodeURIComponent(`[Locally] ${trip.title}`);
    const details = encodeURIComponent(`예약번호: ${trip.orderId}`);
    const dateStr = trip.date.replace(/-/g, ''); 
    const dates = `${dateStr}/${dateStr}`; 
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}`, '_blank');
  };

  // 기능: 주소 복사
  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    alert('주소가 복사되었습니다.');
  };

  const toggleMenu = (id: number) => setActiveMenuId(activeMenuId === id ? null : id);

  if (isLoading) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" size={32} /></div>;
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans" onClick={() => setActiveMenuId(null)}>
      <SiteHeader />

      <main className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black mb-10">나의 여행</h1>

        {/* 1. 예정된 예약 */}
        <section className="mb-16">
          <h2 className="text-xl font-bold mb-6">예정된 예약</h2>
          {upcomingTrips.length > 0 ? (
            upcomingTrips.map(trip => (
              <div key={trip.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow flex flex-col md:flex-row relative mb-6">
                
                {/* 정보 영역 */}
                <div className="p-8 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                       <div className="flex gap-2">
                         <span className="bg-black text-white text-xs font-bold px-3 py-1 rounded-full">{trip.dDay}</span>
                         {trip.isPrivate && <span className="bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1"><Lock size={10} /> Private</span>}
                       </div>
                       
                       <div className="relative">
                         <button onClick={(e) => { e.stopPropagation(); toggleMenu(trip.id); }} className="p-1.5 hover:bg-slate-100 rounded-full"><MoreHorizontal className="text-slate-400"/></button>
                         {activeMenuId === trip.id && (
                           <div className="absolute right-0 top-8 w-48 bg-white border border-slate-100 rounded-xl shadow-xl z-10 overflow-hidden">
                             <button onClick={() => addToCalendar(trip)} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 text-slate-700 flex items-center gap-2"><Calendar size={14}/> 캘린더 추가</button>
                             <button onClick={() => copyAddress(trip.address)} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 text-slate-700 flex items-center gap-2"><Map size={14}/> 주소 복사</button>
                             <div className="border-t my-1"></div>
                             <button onClick={() => handleCancelBooking(trip.id)} className="w-full text-left px-4 py-3 text-sm hover:bg-red-50 text-red-500">예약 취소</button>
                           </div>
                         )}
                       </div>
                    </div>

                    <h3 className="text-2xl font-bold mb-2 hover:underline"><Link href={`/experiences/${trip.expId}`}>{trip.title}</Link></h3>
                    
                    <div className="space-y-3 mt-4">
                      <div className="flex items-center gap-3 text-slate-700"><Calendar className="text-slate-400" size={18}/><span className="font-semibold text-sm">{trip.date} · {trip.time}</span></div>
                      <div className="flex items-center gap-3 text-slate-700"><MapPin className="text-slate-400" size={18}/><span className="font-semibold text-sm">{trip.location}</span></div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-8 pt-8 border-t border-slate-100">
                    <Link href={`/guest/inbox?hostId=${trip.hostId}`} className="flex-1">
                      <button className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm"><MessageSquare size={16}/> 문의</button>
                    </Link>
                    <button onClick={() => handleOpenReceipt(trip)} className="flex-1 border border-slate-200 hover:border-black text-slate-900 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm"><Receipt size={16}/> 영수증</button>
                  </div>
                </div>

                {/* 이미지 */}
                <div className="w-full md:w-80 bg-slate-100 relative min-h-[300px]">
                   {trip.image ? <img src={trip.image} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-slate-400">No Image</div>}
                </div>
              </div>
            ))
          ) : (
            <div className="border border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center py-16 px-4 bg-slate-50/50 text-center">
              <Ghost size={32} className="text-slate-300 mb-4"/>
              <h3 className="text-lg font-bold text-slate-900 mb-1">예정된 여행이 없습니다.</h3>
              <Link href="/" className="mt-4 px-6 py-3 bg-black text-white rounded-xl font-bold text-sm">체험 둘러보기</Link>
            </div>
          )}
        </section>

        {/* 2. 지난 여행 */}
        <section>
          <h2 className="text-xl font-bold mb-6">지난 여행</h2>
          {pastTrips.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {pastTrips.map(trip => (
                <div key={trip.id} className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="h-40 bg-slate-200 relative">
                        {trip.image && <img src={trip.image} className="w-full h-full object-cover"/>}
                        {trip.status === 'cancelled' && <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold">취소됨</div>}
                    </div>
                    <div className="p-4">
                        <div className="font-bold mb-1 truncate">{trip.title}</div>
                        <div className="text-xs text-slate-500 mb-3">{trip.date}</div>
                        <button onClick={() => handleOpenReview(trip)} className="w-full border border-slate-200 text-slate-600 text-xs font-bold py-2 rounded-lg hover:bg-slate-50">후기 작성</button>
                    </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-400 text-sm py-10">다녀온 여행이 없습니다.</div>
          )}
        </section>
      </main>

      {/* 영수증 모달 */}
      {isReceiptModalOpen && selectedTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl relative animate-in zoom-in-95">
            <div className="bg-slate-900 text-white p-6 text-center relative">
              <button onClick={() => setIsReceiptModalOpen(false)} className="absolute top-4 right-4 text-white/50 hover:text-white"><X size={20}/></button>
              <h3 className="font-bold text-lg">Booking Confirmed</h3>
              <p className="text-slate-400 text-xs font-mono">{selectedTrip.orderId}</p>
            </div>
            <div className="p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-2">{selectedTrip.title}</h2>
              <div className="space-y-4 border-b border-dashed border-slate-200 pb-6 mb-6 mt-4">
                <div className="flex justify-between text-sm"><span className="text-slate-500">날짜</span><span className="font-bold">{selectedTrip.date}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">인원</span><span className="font-bold">{selectedTrip.guests}명</span></div>
              </div>
              <div className="flex justify-between items-center mb-6">
                <span className="text-slate-500 font-bold">Total</span>
                <span className="text-2xl font-black text-slate-900">₩{Number(selectedTrip.price).toLocaleString()}</span>
              </div>
              <div className="flex gap-3">
                 <button onClick={() => setIsReceiptModalOpen(false)} className="flex-1 py-3 bg-slate-100 font-bold rounded-xl text-sm">닫기</button>
                 <button className="flex-1 py-3 bg-black text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2"><Share2 size={14}/> 공유</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 후기 모달 */}
      {isReviewModalOpen && selectedTrip && <ReviewModal trip={selectedTrip} onClose={() => setIsReviewModalOpen(false)} />}
    </div>
  );
}