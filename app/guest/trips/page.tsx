'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Ghost, AlertCircle } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import ReviewModal from '@/app/components/ReviewModal';
import Link from 'next/link';

// 분리된 컴포넌트 import
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

      // ✅ 기능 유지: full_name 및 외래키 명시적 사용
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
            image: booking.experiences?.photos?.[0],
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
      <main className="max-w-screen-lg mx-auto px-6 py-16 md:py-24">
        <h1 className="text-4xl font-extrabold mb-12 tracking-tight">여행</h1>
        
        {errorMsg && (
            <div className="bg-red-50 text-red-600 p-4 mb-8 rounded-xl flex items-center gap-3 text-sm font-medium">
                <AlertCircle size={20}/>
                <span>데이터를 불러오지 못했습니다: {errorMsg}</span>
            </div>
        )}

        {/* 예정된 예약 */}
        <section className="mb-24">
          <h2 className="text-2xl font-bold mb-8">예정된 예약</h2>
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
              <div className="border border-dashed border-slate-200 rounded-3xl py-24 text-center flex flex-col items-center justify-center">
                <Ghost className="text-slate-300 mb-4" size={32}/>
                <p className="text-lg font-medium text-slate-900 mb-2">아직 예정된 여행이 없습니다</p>
                <p className="text-slate-500 text-sm mb-6">새로운 로컬 체험을 찾아 떠나보세요.</p>
                <Link href="/" className="px-6 py-3 bg-slate-900 text-white rounded-full font-bold text-sm hover:bg-slate-800 transition-colors shadow-lg shadow-slate-100">
                  체험 둘러보기
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* 지난 여행 */}
        <section>
          <h2 className="text-2xl font-bold mb-8">지난 여행</h2>
          {pastTrips.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pastTrips.map(trip => (
                <PastTripCard key={trip.id} trip={trip} onOpenReview={openReview} />
              ))}
            </div>
          ) : (
            <div className="text-slate-500 text-sm py-4 border-t border-slate-100">다녀온 여행이 없습니다.</div>
          )}
        </section>
      </main>

      {/* 모달 */}
      {isReceiptModalOpen && selectedTrip && <ReceiptModal trip={selectedTrip} onClose={() => setIsReceiptModalOpen(false)} />}
      {isReviewModalOpen && selectedTrip && <ReviewModal trip={selectedTrip} onClose={() => setIsReviewModalOpen(false)} />}
    </div>
  );
}