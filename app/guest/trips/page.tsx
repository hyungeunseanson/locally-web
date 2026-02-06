'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Ghost, AlertCircle, History } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import ReviewModal from '@/app/components/ReviewModal';

// 컴포넌트 import
import TripCard from './components/TripCard';     
import ReceiptModal from './components/ReceiptModal'; 
import PastTripCard from './components/PastTripCard'; 

export default function GuestTripsPage() {
  const [upcomingTrips, setUpcomingTrips] = useState<any[]>([]);
  const [pastTrips, setPastTrips] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
      if (!user) { setIsLoading(false); return; }

      // ✅ 쿼리 유지: full_name 및 명시적 FK 사용
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          *,
          experiences (
            id, title, city, photos, address, host_id,
            profiles!experiences_host_id_fkey (full_name, phone)
          )
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: true });

      if (error) {
        console.error("데이터 로딩 실패:", error);
        setErrorMsg(error.message);
        return;
      }

      if (bookings) {
        const upcoming: any[] = [];
        const past: any[] = [];
        const today = new Date();
        today.setHours(0,0,0,0);

        bookings.forEach((booking: any) => {
          if (!booking.experiences) return;

          const tripDate = new Date(booking.date);
          const isFuture = tripDate >= today && booking.status !== 'cancelled';
          const diffDays = Math.ceil((tripDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)); 
          const dDay = isFuture ? (diffDays === 0 ? '오늘' : `D-${diffDays}`) : null;

          const hostData = Array.isArray(booking.experiences.profiles) 
            ? booking.experiences.profiles[0] 
            : booking.experiences.profiles;

          const formattedTrip = {
            id: booking.id,
            title: booking.experiences.title,
            hostName: hostData?.full_name || 'Locally Host',
            hostPhone: hostData?.phone,
            hostId: booking.experiences.host_id,
            date: booking.date, 
            time: booking.time || '14:00',
            location: booking.experiences.city || '서울',
            address: booking.experiences.address || booking.experiences.city,
            image: booking.experiences.photos?.[0],
            dDay: dDay,
            isPrivate: booking.type === 'private',
            status: booking.status,
            price: booking.amount || booking.total_price || 0,
            guests: booking.guests || 1,
            expId: booking.experience_id,
            orderId: booking.order_id || booking.id.substring(0,8).toUpperCase(),
          };

          if (isFuture) upcoming.push(formattedTrip);
          else past.push(formattedTrip);
        });

        setUpcomingTrips(upcoming);
        setPastTrips(past.reverse());
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelBooking = async (id: number) => {
    if (!confirm('예약을 취소하시겠습니까?')) return;
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
    if (!error) { 
      alert('예약이 취소되었습니다.'); 
      fetchMyTrips(); 
    } else { 
      alert('취소 실패: ' + error.message); 
    }
  };

  const openReceipt = (trip: any) => { setSelectedTrip(trip); setIsReceiptModalOpen(true); };
  const openReview = (trip: any) => { setSelectedTrip(trip); setIsReviewModalOpen(true); };

  if (isLoading) return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" size={32} /></div>;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      <main className="max-w-7xl mx-auto px-6 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-12 tracking-tight text-slate-900">여행</h1>
        
        {errorMsg && (
            <div className="bg-red-50 text-red-600 p-4 mb-8 rounded-xl flex items-center gap-3 text-sm font-medium">
                <AlertCircle size={20}/>
                <span>오류: {errorMsg}</span>
            </div>
        )}

        {/* 🟢 2컬럼 레이아웃 시작 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          
          {/* 1. 왼쪽 메인: 예정된 여행 (비중 높게) */}
          <section className="lg:col-span-7">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              예정된 일정 <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full">{upcomingTrips.length}</span>
            </h2>
            
            <div className="flex flex-col gap-8">
              {upcomingTrips.length > 0 ? (
                upcomingTrips.map(trip => (
                  <TripCard 
                    key={trip.id} 
                    trip={trip} 
                    onCancel={handleCancelBooking} 
                    onOpenReceipt={openReceipt} 
                  />
                ))
              ) : (
                <div className="border border-dashed border-slate-200 rounded-3xl py-24 text-center flex flex-col items-center justify-center bg-slate-50/50">
                  <Ghost className="text-slate-300 mb-4" size={32}/>
                  <p className="text-lg font-medium text-slate-900 mb-1">예정된 여행이 없습니다</p>
                  <Link href="/" className="text-sm text-slate-500 hover:text-black underline underline-offset-4 transition-colors">
                    새로운 체험 찾아보기
                  </Link>
                </div>
              )}
            </div>
          </section>

          {/* 2. 오른쪽 사이드: 지난 여행 (리스트 형태) */}
          <aside className="lg:col-span-5">
            <div className="sticky top-24"> {/* 스크롤 시 따라옴 */}
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-400">
                <History size={20}/> 지난 여행
              </h2>
              
              {pastTrips.length > 0 ? (
                <div className="space-y-4">
                  {pastTrips.map(trip => (
                    <PastTripCard key={trip.id} trip={trip} onOpenReview={openReview} />
                  ))}
                </div>
              ) : (
                <div className="text-slate-400 text-sm py-4">다녀온 여행 내역이 없습니다.</div>
              )}
            </div>
          </aside>

        </div>
      </main>

      {/* 모달 */}
      {isReceiptModalOpen && selectedTrip && <ReceiptModal trip={selectedTrip} onClose={() => setIsReceiptModalOpen(false)} />}
      {isReviewModalOpen && selectedTrip && <ReviewModal trip={selectedTrip} onClose={() => setIsReviewModalOpen(false)} />}
    </div>
  );
}