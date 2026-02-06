'use client';

import React, { useEffect, useState } from 'react';
import { 
  Calendar, MapPin, MoreHorizontal, MessageSquare, Receipt, Ghost, Lock, Loader2 
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client'; // Supabase 클라이언트
import SiteHeader from '@/app/components/SiteHeader';
import TripCard from '@/app/components/TripCard';     
import ReviewModal from '@/app/components/ReviewModal';

export default function GuestTripsPage() {
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  
  // 상태 관리
  const [upcomingTrips, setUpcomingTrips] = useState<any[]>([]);
  const [pastTrips, setPastTrips] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    fetchMyTrips();
  }, []);

  const fetchMyTrips = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; // 로그인 안 된 경우 처리 필요 (추후)

      // 1. 내 예약 내역 가져오기 (체험 정보 + 호스트 정보 조인)
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          *,
          experiences (
            id, title, city, category, photos, price,
            host_id,
            profiles:host_id (name) 
          )
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: true }); // 날짜순 정렬

      if (error) {
        console.error('예약 불러오기 실패:', error);
        return;
      }

      if (bookings) {
        // 2. 날짜 기준으로 예정/지난 여행 분류
        const now = new Date();
        const upcoming: any[] = [];
        const past: any[] = [];

        bookings.forEach((booking: any) => {
          const tripDate = new Date(booking.date);
          const isFuture = tripDate >= now;
          
          // D-Day 계산
          const diffTime = Math.abs(tripDate.getTime() - now.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          const dDay = isFuture ? (diffDays === 0 ? 'D-Day' : `D-${diffDays}`) : null;

          // 데이터 포맷팅
          const formattedTrip = {
            id: booking.id,
            title: booking.experiences?.title,
            host: booking.experiences?.profiles?.name || '알 수 없음',
            date: tripDate.toLocaleDateString() + ' ' + (booking.time || ''), // 시간 필드 가정
            location: booking.experiences?.city || '장소 정보 없음',
            image: booking.experiences?.photos?.[0] || 'https://via.placeholder.com/400',
            dDay: dDay,
            isPrivate: booking.type === 'private', // DB에 type 컬럼이 있다고 가정
            status: booking.status, // confirmed, pending 등
            price: booking.total_price,
            expId: booking.experience_id,
            isReviewed: false // 추후 리뷰 여부 체크 로직 추가 필요
          };

          if (isFuture) {
            upcoming.push(formattedTrip);
          } else {
            past.push(formattedTrip);
          }
        });

        setUpcomingTrips(upcoming);
        setPastTrips(past.reverse()); // 지난 여행은 최신순으로
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenReview = (trip: any) => {
    setSelectedTrip(trip);
    setIsReviewModalOpen(true);
  };

  const toggleMenu = (id: number) => {
    setActiveMenuId(activeMenuId === id ? null : id);
  };

  const handleCancelBooking = async (id: number) => {
    if (!confirm('정말 예약을 취소하시겠습니까?')) return;
    
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
    if (!error) {
      alert('예약이 취소되었습니다.');
      fetchMyTrips(); // 목록 새로고침
    } else {
      alert('취소 실패: ' + error.message);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans" onClick={() => setActiveMenuId(null)}>
      <SiteHeader />

      <main className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black mb-10">나의 여행</h1>

        {/* 1. 예정된 예약 섹션 */}
        <section className="mb-16">
          <h2 className="text-xl font-bold mb-6">예정된 예약</h2>
          
          {upcomingTrips.length > 0 ? (
            upcomingTrips.map(trip => (
              <div key={trip.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow flex flex-col md:flex-row relative mb-6">
                <div className="p-8 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                       <div className="flex gap-2">
                         <span className="bg-black text-white text-xs font-bold px-3 py-1 rounded-full">{trip.dDay}</span>
                         {trip.status === 'pending' && <span className="bg-yellow-100 text-yellow-700 text-xs font-bold px-3 py-1 rounded-full">승인 대기중</span>}
                         {trip.isPrivate && (
                           <span className="bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 border border-slate-700">
                             <Lock size={10} /> 단독 투어
                           </span>
                         )}
                       </div>
                       
                       {/* 메뉴 버튼 */}
                       <div className="relative">
                         <button 
                           onClick={(e) => { e.stopPropagation(); toggleMenu(trip.id); }} 
                           className="text-slate-400 hover:text-black p-1.5 rounded-full hover:bg-slate-100 transition-colors"
                         >
                           <MoreHorizontal/>
                         </button>
                         {activeMenuId === trip.id && (
                           <div className="absolute right-0 top-8 w-40 bg-white border border-slate-100 rounded-xl shadow-xl z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                             <Link href={`/experiences/${trip.expId}`}>
                               <button className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 font-medium text-slate-700">체험 다시 보기</button>
                             </Link>
                             <button 
                               onClick={() => handleCancelBooking(trip.id)}
                               className="w-full text-left px-4 py-3 text-sm hover:bg-red-50 text-red-500 font-medium"
                             >
                               예약 취소 요청
                             </button>
                           </div>
                         )}
                       </div>
                    </div>
                    <h3 className="text-2xl font-bold mb-2">{trip.title}</h3>
                    <p className="text-slate-500 mb-6">호스트: {trip.host}</p>
                    
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-slate-700">
                        <Calendar className="text-slate-400" size={20}/>
                        <span className="font-semibold">{trip.date}</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-700">
                        <MapPin className="text-slate-400" size={20}/>
                        <span className="font-semibold">{trip.location}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-8 pt-8 border-t border-slate-100">
                    <Link href="/guest/inbox" className="flex-1">
                      <button className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors">
                        <MessageSquare size={16}/> 호스트에게 메시지
                      </button>
                    </Link>
                    <button className="flex-1 border border-slate-200 hover:border-black text-slate-900 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors">
                      <Receipt size={16}/> 영수증 보기
                    </button>
                  </div>
                </div>

                <div className="w-full md:w-80 bg-slate-100 relative min-h-[300px]">
                   <img src={trip.image} alt={trip.title} className="w-full h-full object-cover"/>
                   <div className="absolute inset-0 bg-black/10"></div>
                </div>
              </div>
            ))
          ) : (
            <div className="border border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center py-16 px-4 bg-slate-50/50 text-center">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                <Ghost size={32} className="text-slate-300"/>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">아직 예정된 여행이 없습니다.</h3>
              <p className="text-slate-500 text-sm mb-6">설레는 첫 여행을 계획해보세요!</p>
              <Link href="/" className="px-6 py-3 bg-black text-white rounded-xl font-bold hover:scale-105 transition-transform text-sm shadow-lg">
                체험 둘러보기
              </Link>
            </div>
          )}
        </section>

        {/* 2. 지난 여행 섹션 */}
        <section>
          <h2 className="text-xl font-bold mb-6">지난 여행</h2>
          {pastTrips.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {pastTrips.map(trip => (
                <TripCard 
                  key={trip.id}
                  {...trip}
                  onReviewClick={handleOpenReview}
                />
              ))}
              
              <div className="border border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center p-6 text-slate-400 hover:border-slate-400 hover:bg-slate-50 transition-colors cursor-pointer min-h-[300px] group">
                 <span className="font-bold mb-1 group-hover:text-slate-600 transition-colors">다음 여행을 떠나보세요</span>
                 <Link href="/" className="text-sm underline text-black">체험 둘러보기</Link>
              </div>
            </div>
          ) : (
            <div className="text-slate-400 text-sm py-10">다녀온 여행이 없습니다.</div>
          )}
        </section>
      </main>

      {isReviewModalOpen && selectedTrip && (
        <ReviewModal trip={selectedTrip} onClose={() => setIsReviewModalOpen(false)} />
      )}
    </div>
  );
}