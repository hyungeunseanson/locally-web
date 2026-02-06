'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Ghost, History, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import ReviewModal from '@/app/components/ReviewModal';
import TripCard from './components/TripCard';     
import ReceiptModal from './components/ReceiptModal'; 

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
      console.log("🚀 여행 목록 불러오기 시작..."); // 디버그 로그
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log("❌ 로그인된 유저가 없습니다.");
        setIsLoading(false);
        return; 
      }
      console.log("✅ 유저 확인:", user.id);

      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`*, experiences (id, title, city, photos, address, host_id, profiles:host_id (name, phone))`)
        .eq('user_id', user.id)
        .order('date', { ascending: true });

      if (error) {
        console.error("❌ Supabase 에러:", error);
        setErrorMsg(error.message);
        throw error;
      }

      console.log("📦 가져온 데이터:", bookings); // 데이터 확인용

      if (bookings) {
        const upcoming: any[] = [];
        const past: any[] = [];
        const today = new Date();
        today.setHours(0,0,0,0);

        bookings.forEach((booking: any) => {
          if (!booking.experiences) return; // 체험 정보 없으면 패스

          const tripDate = new Date(booking.date);
          const isFuture = tripDate >= today && booking.status !== 'cancelled';
          const diffDays = Math.ceil((tripDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)); 
          
          const formattedTrip = {
            id: booking.id,
            title: booking.experiences.title,
            hostName: booking.experiences.profiles?.name || '알 수 없음',
            hostPhone: booking.experiences.profiles?.phone,
            hostId: booking.experiences.host_id,
            date: booking.date, 
            time: booking.time || '14:00',
            location: booking.experiences.city || '서울',
            address: booking.experiences.address || booking.experiences.city,
            image: booking.experiences.photos?.[0],
            dDay: isFuture ? (diffDays === 0 ? '오늘' : `D-${diffDays}`) : null,
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
      console.error("Fetch Logic Error:", err);
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelBooking = async (id: number) => {
    if (!confirm('취소하시겠습니까?')) return;
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
    fetchMyTrips();
  };

  const openReceipt = (trip: any) => { setSelectedTrip(trip); setIsReceiptModalOpen(true); };
  const openReview = (trip: any) => { setSelectedTrip(trip); setIsReviewModalOpen(true); };

  if (isLoading) return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" size={32} /></div>;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black mb-10 tracking-tight">여행</h1>
        {errorMsg && <div className="bg-red-50 text-red-600 p-4 mb-4 rounded-lg flex items-center gap-2"><AlertCircle size={20}/> 오류 발생: {errorMsg}</div>}

        {/* 예정된 예약 */}
        <section className="mb-20">
          <h2 className="text-xl font-bold mb-6">다가오는 예약</h2>
          <div className="flex flex-col gap-6">
            {upcomingTrips.length > 0 ? (
              upcomingTrips.map(trip => (
                <TripCard key={trip.id} trip={trip} onCancel={handleCancelBooking} onOpenReceipt={openReceipt} />
              ))
            ) : (
              <div className="border border-dashed border-slate-200 rounded-2xl py-20 text-center text-slate-400">예정된 여행이 없습니다.</div>
            )}
          </div>
        </section>

        {/* 지난 여행 */}
        <section>
          <h2 className="text-xl font-bold mb-6 text-slate-400">지난 여행</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pastTrips.map(trip => (
              <div key={trip.id} className="border border-slate-200 rounded-2xl overflow-hidden p-5">
                  <div className="font-bold mb-1 truncate">{trip.title}</div>
                  <div className="text-xs text-slate-500 mb-4">{trip.date}</div>
                  {trip.status !== 'cancelled' && <button onClick={() => openReview(trip)} className="text-xs font-bold underline">후기 작성</button>}
              </div>
            ))}
          </div>
        </section>
      </main>
      {isReceiptModalOpen && selectedTrip && <ReceiptModal trip={selectedTrip} onClose={() => setIsReceiptModalOpen(false)} />}
      {isReviewModalOpen && selectedTrip && <ReviewModal trip={selectedTrip} onClose={() => setIsReviewModalOpen(false)} />}
    </div>
  );
}