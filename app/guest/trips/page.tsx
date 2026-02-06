'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Ghost, AlertCircle, CalendarClock } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import ReviewModal from '@/app/components/ReviewModal';
import Link from 'next/link';

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

      // ✅ 쿼리 및 기능 보존: full_name 및 FK 명시
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
            hostName: hostData?.full_name || 'Locally Host', // ✅ full_name 유지
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
    if (!confirm('정말 예약을 취소하시겠습니까?')) return;
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
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-black tracking-tight mb-2">여행</h1>
          <p className="text-slate-500">예정된 일정을 확인하세요.</p>
        </div>
        
        {errorMsg && (
            <div className="bg-red-50 text-red-600 p-4 mb-8 rounded-xl flex items-center gap-3 text-sm font-medium">
                <AlertCircle size={20}/>
                <span>데이터 불러오기 오류: {errorMsg}</span>
            </div>
        )}

        {/* 🟢 예정된 예약 (타임라인 스타일 적용) */}
        <section className="mb-16">
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
            다가오는 일정 <span className="bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded-full">{upcomingTrips.length}</span>
          </h2>
          
          {upcomingTrips.length > 0 ? (
            <div className="relative border-l-2 border-slate-100 ml-3 md:ml-4 space-y-8 pb-4">
              {upcomingTrips.map((trip, index) => (
                <div key={trip.id} className="relative pl-8 md:pl-10">
                  {/* 타임라인 점 */}
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-900 border-4 border-white shadow-sm z-10"></div>
                  
                  {/* 날짜 헤더 */}
                  <div className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                    {trip.date} <span className="text-slate-300 font-light">|</span> <span className="text-slate-500 font-medium">{trip.dDay}</span>
                  </div>

                  {/* 카드 컴포넌트 */}
                  <TripCard 
                    trip={trip} 
                    onCancel={handleCancelBooking} 
                    onOpenReceipt={openReceipt} 
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-100 rounded-2xl py-16 text-center flex flex-col items-center">
              <CalendarClock className="text-slate-300 mb-3" size={32}/>
              <p className="text-slate-500 font-medium mb-4">예정된 일정이 없습니다.</p>
              <Link href="/" className="text-sm font-bold text-slate-900 underline underline-offset-4 hover:text-blue-600">
                새로운 체험 둘러보기
              </Link>
            </div>
          )}
        </section>

        {/* 지난 여행 */}
        <section>
          <h2 className="text-lg font-bold mb-6 text-slate-400">지난 여행</h2>
          {pastTrips.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pastTrips.map(trip => (
                <PastTripCard key={trip.id} trip={trip} onOpenReview={openReview} />
              ))}
            </div>
          ) : (
            <div className="text-slate-400 text-sm">다녀온 여행 내역이 없습니다.</div>
          )}
        </section>
      </main>

      {/* 모달 */}
      {isReceiptModalOpen && selectedTrip && <ReceiptModal trip={selectedTrip} onClose={() => setIsReceiptModalOpen(false)} />}
      {isReviewModalOpen && selectedTrip && <ReviewModal trip={selectedTrip} onClose={() => setIsReviewModalOpen(false)} />}
    </div>
  );
}