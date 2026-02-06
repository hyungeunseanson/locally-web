'use client';

import React, { useEffect, useState } from 'react';
import { 
  Calendar, MapPin, MoreHorizontal, MessageSquare, Receipt, Ghost, Lock, Loader2 
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import ReviewModal from '@/app/components/ReviewModal';

export default function GuestTripsPage() {
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
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
      if (!user) return;

      // 1. 단순화된 쿼리 (관계 설정 에러 방지)
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          *,
          experiences (
            id, title, city, photos
          )
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: true });

      if (error) {
        console.error('예약 불러오기 에러:', error);
        return;
      }

      if (bookings) {
        const now = new Date();
        const upcoming: any[] = [];
        const past: any[] = [];

        bookings.forEach((booking: any) => {
          const tripDate = new Date(booking.date); // booking.date가 'YYYY-MM-DD' 문자열이어도 잘 변환됨
          // 날짜 비교 시 시간 정보 제거 (단순 날짜 비교)
          const today = new Date();
          today.setHours(0,0,0,0);
          
          const isFuture = tripDate >= today;
          
          // D-Day 계산
          const diffTime = tripDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          const dDay = isFuture ? (diffDays === 0 ? 'D-Day' : `D-${diffDays}`) : null;

          const formattedTrip = {
            id: booking.id,
            title: booking.experiences?.title || '체험 정보 없음',
            host: 'Host', // 관계 설정 복잡성을 피하기 위해 임시 텍스트
            date: booking.date, 
            location: booking.experiences?.city || '장소 미정',
            image: booking.experiences?.photos?.[0] || 'https://images.unsplash.com/photo-1542051841857-5f90071e7989', // 기본 이미지
            dDay: dDay,
            isPrivate: booking.type === 'private',
            status: booking.status,
            price: booking.amount || booking.total_price,
            expId: booking.experience_id,
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
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMenu = (id: number) => setActiveMenuId(activeMenuId === id ? null : id);

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

        {/* 예정된 예약 */}
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
                         {trip.isPrivate && (
                           <span className="bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 border border-slate-700">
                             <Lock size={10} /> 단독 투어
                           </span>
                         )}
                       </div>
                    </div>
                    <h3 className="text-2xl font-bold mb-2">{trip.title}</h3>
                    <div className="space-y-4 mt-4">
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
                    <Link href={`/experiences/${trip.expId}`} className="flex-1">
                      <button className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold py-3 rounded-xl text-sm transition-colors">
                        상세 보기
                      </button>
                    </Link>
                  </div>
                </div>
                <div className="w-full md:w-80 bg-slate-100 relative min-h-[300px]">
                   <img src={trip.image} alt={trip.title} className="w-full h-full object-cover"/>
                </div>
              </div>
            ))
          ) : (
            <div className="border border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center py-16 px-4 bg-slate-50/50 text-center">
              <Ghost size={32} className="text-slate-300 mb-4"/>
              <h3 className="text-lg font-bold text-slate-900 mb-1">아직 예정된 여행이 없습니다.</h3>
            </div>
          )}
        </section>

        {/* 지난 여행 */}
        <section>
          <h2 className="text-xl font-bold mb-6">지난 여행</h2>
          {pastTrips.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {pastTrips.map(trip => (
                // TripCard 컴포넌트를 사용하거나 직접 렌더링
                <div key={trip.id} className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="h-48 bg-slate-200"><img src={trip.image} className="w-full h-full object-cover"/></div>
                    <div className="p-4">
                        <div className="font-bold mb-1">{trip.title}</div>
                        <div className="text-xs text-slate-500">{trip.date}</div>
                    </div>
                </div>
              ))}
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