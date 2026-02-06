'use client';

import React, { useEffect, useState } from 'react';
import { 
  Calendar, MapPin, MoreHorizontal, MessageSquare, Receipt, Ghost, Lock, Loader2, X, Share2, Map, Clock, CheckCircle2
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

      // ✅ 주소(address)와 호스트ID(host_id)를 가져옵니다.
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
            title: booking.experiences?.title || '체험 정보 없음',
            hostName: 'Locally Host', 
            hostId: booking.experiences?.host_id, // 채팅 연결용
            date: booking.date, 
            time: booking.time || '14:00', // 시간 정보가 없으면 기본값
            location: booking.experiences?.city || '서울',
            address: booking.experiences?.address || '상세 주소 미정', // 지도/복사용
            image: booking.experiences?.photos?.[0],
            dDay: dDay,
            isPrivate: booking.type === 'private',
            status: booking.status,
            price: booking.amount || booking.total_price || 50000,
            guests: booking.guests || 1,
            expId: booking.experience_id,
            orderId: booking.order_id || `ORD-${booking.id.substring(0,8).toUpperCase()}`,
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

  // 1️⃣ 예약 취소 기능
  const handleCancelBooking = async (id: number) => {
    if (!confirm('정말 예약을 취소하시겠습니까?\n취소 시 호스트에게 알림이 전송됩니다.')) return;
    
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
    if (!error) {
      alert('예약이 취소되었습니다.');
      fetchMyTrips(); 
    } else {
      alert('취소 실패: ' + error.message);
    }
  };

  // 2️⃣ 캘린더 추가 기능 (구글 캘린더)
  const addToCalendar = (trip: any) => {
    const text = encodeURIComponent(`[Locally] ${trip.title}`);
    const details = encodeURIComponent(`예약번호: ${trip.orderId}\n장소: ${trip.address}`);
    const location = encodeURIComponent(trip.address);
    const dateStr = trip.date.replace(/-/g, ''); 
    const dates = `${dateStr}/${dateStr}`; 
    
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`, '_blank');
  };

  // 3️⃣ 주소 복사 기능
  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    alert(`주소가 복사되었습니다!\n${address}`);
  };

  // 모달 핸들러
  const handleOpenReceipt = (trip: any) => { setSelectedTrip(trip); setIsReceiptModalOpen(true); };
  const handleOpenReview = (trip: any) => { setSelectedTrip(trip); setIsReviewModalOpen(true); };
  const toggleMenu = (id: number) => setActiveMenuId(activeMenuId === id ? null : id);

  if (isLoading) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" size={32} /></div>;
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans" onClick={() => setActiveMenuId(null)}>
      <SiteHeader />

      <main className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black mb-10">나의 여행</h1>

        {/* 🟢 예정된 예약 섹션 */}
        <section className="mb-16">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            예정된 예약 <span className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded-full">{upcomingTrips.length}</span>
          </h2>
          
          {upcomingTrips.length > 0 ? (
            upcomingTrips.map(trip => (
              <div key={trip.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow flex flex-col md:flex-row relative mb-6 group">
                
                {/* 정보 영역 */}
                <div className="p-8 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                       <div className="flex gap-2">
                         <span className="bg-black text-white text-xs font-bold px-3 py-1 rounded-full">{trip.dDay}</span>
                         {trip.isPrivate && <span className="bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1"><Lock size={10} /> Private</span>}
                       </div>
                       
                       {/* 더보기 메뉴 (...) */}
                       <div className="relative">
                         <button 
                           onClick={(e) => { e.stopPropagation(); toggleMenu(trip.id); }} 
                           className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"
                         >
                           <MoreHorizontal className="text-slate-400"/>
                         </button>
                         {activeMenuId === trip.id && (
                           <div className="absolute right-0 top-8 w-48 bg-white border border-slate-100 rounded-xl shadow-xl z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                             <button onClick={() => addToCalendar(trip)} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 text-slate-700 flex items-center gap-2 border-b border-slate-50">
                               <Calendar size={14}/> 캘린더에 추가
                             </button>
                             <button onClick={() => copyAddress(trip.address)} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 text-slate-700 flex items-center gap-2 border-b border-slate-50">
                               <Map size={14}/> 주소 복사
                             </button>
                             <button onClick={() => handleCancelBooking(trip.id)} className="w-full text-left px-4 py-3 text-sm hover:bg-red-50 text-red-500 font-medium">
                               예약 취소
                             </button>
                           </div>
                         )}
                       </div>
                    </div>

                    <h3 className="text-2xl font-bold mb-2 hover:underline">
                      <Link href={`/experiences/${trip.expId}`}>{trip.title}</Link>
                    </h3>
                    
                    <div className="space-y-3 mt-4">
                      <div className="flex items-center gap-3 text-slate-700">
                        <Calendar className="text-slate-400" size={18}/>
                        <span className="font-semibold text-sm">{trip.date} · {trip.time}</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-700">
                        <MapPin className="text-slate-400" size={18}/>
                        <span className="font-semibold text-sm">{trip.location}</span>
                      </div>
                    </div>
                  </div>

                  {/* 하단 액션 버튼들 */}
                  <div className="flex gap-3 mt-8 pt-8 border-t border-slate-100">
                    <Link href={trip.hostId ? `/guest/inbox?hostId=${trip.hostId}` : '#'} className="flex-1">
                      <button className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors">
                        <MessageSquare size={16}/> 호스트 문의
                      </button>
                    </Link>
                    <button 
                      onClick={() => handleOpenReceipt(trip)}
                      className="flex-1 border border-slate-200 hover:border-black text-slate-900 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors"
                    >
                      <Receipt size={16}/> 영수증 보기
                    </button>
                  </div>
                </div>

                {/* 이미지 영역 */}
                <div className="w-full md:w-80 bg-slate-100 relative min-h-[300px]">
                   {trip.image ? (
                     <img src={trip.image} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"/>
                   ) : (
                     <div className="w-full h-full flex items-center justify-center text-slate-400">No Image</div>
                   )}
                </div>
              </div>
            ))
          ) : (
            <div className="border border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center py-16 px-4 bg-slate-50/50 text-center">
              <Ghost size={32} className="text-slate-300 mb-4"/>
              <h3 className="text-lg font-bold text-slate-900 mb-1">예정된 여행이 없습니다.</h3>
              <Link href="/" className="mt-4 px-6 py-3 bg-black text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors">
                체험 둘러보기
              </Link>
            </div>
          )}
        </section>

        {/* 🟠 지난 여행 섹션 */}
        <section>
          <h2 className="text-xl font-bold mb-6 text-slate-400">지난 여행</h2>
          {pastTrips.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {pastTrips.map(trip => (
                <div key={trip.id} className="border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg transition-all bg-white group">
                    <div className="h-40 bg-slate-200 relative overflow-hidden">
                        {trip.image && <img src={trip.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform"/>}
                        {trip.status === 'cancelled' && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold backdrop-blur-sm">취소된 예약</div>
                        )}
                    </div>
                    <div className="p-4">
                        <div className="font-bold mb-1 truncate text-slate-900">{trip.title}</div>
                        <div className="text-xs text-slate-500 mb-4">{trip.date}</div>
                        
                        {trip.status !== 'cancelled' && (
                          <button 
                            onClick={() => handleOpenReview(trip)}
                            className="w-full border border-slate-200 text-slate-600 text-xs font-bold py-2.5 rounded-lg hover:bg-slate-900 hover:text-white transition-colors"
                          >
                            후기 작성하기
                          </button>
                        )}
                    </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-400 text-sm py-10">다녀온 여행이 없습니다.</div>
          )}
        </section>
      </main>

      {/* 🎫 영수증(상세) 모달 */}
      {isReceiptModalOpen && selectedTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl relative">
            
            {/* 티켓 헤더 */}
            <div className="bg-slate-900 text-white p-6 text-center relative">
              <button onClick={() => setIsReceiptModalOpen(false)} className="absolute top-4 right-4 text-white/50 hover:text-white rounded-full p-1 hover:bg-white/10 transition-colors"><X size={20}/></button>
              <div className="flex justify-center mb-2"><CheckCircle2 className="text-green-400" size={32}/></div>
              <h3 className="font-bold text-lg">Booking Confirmed</h3>
              <p className="text-slate-400 text-xs font-mono mt-1">{selectedTrip.orderId}</p>
            </div>

            {/* 티켓 내용 */}
            <div className="p-6 relative">
              <div className="absolute -top-3 left-0 w-6 h-6 bg-slate-900 rounded-full"></div>
              <div className="absolute -top-3 right-0 w-6 h-6 bg-slate-900 rounded-full"></div>

              <div className="mb-6 text-center">
                <h2 className="text-xl font-bold text-slate-900 mb-1">{selectedTrip.title}</h2>
                <div className="text-sm text-slate-500">{selectedTrip.location}</div>
              </div>

              <div className="space-y-4 border-b border-dashed border-slate-200 pb-6 mb-6">
                <div className="flex justify-between text-sm items-center">
                  <span className="text-slate-500 flex items-center gap-2"><Calendar size={14}/> 날짜</span>
                  <span className="font-bold text-slate-900">{selectedTrip.date}</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-slate-500 flex items-center gap-2"><Clock size={14}/> 시간</span>
                  <span className="font-bold text-slate-900">{selectedTrip.time}</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-slate-500 flex items-center gap-2"><Lock size={14}/> 인원</span>
                  <span className="font-bold text-slate-900">{selectedTrip.guests}명</span>
                </div>
              </div>

              <div className="flex justify-between items-center mb-6">
                <span className="text-slate-500 font-bold">Total Paid</span>
                <span className="text-2xl font-black text-slate-900">₩{Number(selectedTrip.price).toLocaleString()}</span>
              </div>

              <div className="flex gap-3">
                 <button onClick={() => setIsReceiptModalOpen(false)} className="flex-1 py-3 bg-slate-100 font-bold rounded-xl text-sm hover:bg-slate-200 transition-colors">닫기</button>
                 <button className="flex-1 py-3 bg-black text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors">
                   <Share2 size={14}/> 공유하기
                 </button>
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