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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return; 
      }

      // ✅ [수정완료] name -> full_name 으로 변경
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

          // 호스트 정보 가져오기
          const hostData = Array.isArray(booking.experiences.profiles) 
            ? booking.experiences.profiles[0] 
            : booking.experiences.profiles;

          const formattedTrip = {
            id: booking.id,
            title: booking.experiences.title,
            // ✅ [수정완료] 여기도 full_name으로 변경
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
      <main className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black mb-10 tracking-tight">여행</h1>
        
        {errorMsg && (
            <div className="bg-red-50 text-red-600 p-4 mb-6 rounded-lg flex items-center gap-2">
                <AlertCircle size={20}/>
                <span>데이터를 불러오지 못했습니다: {errorMsg}</span>
            </div>
        )}

        <section className="mb-20">
          <h2 className="text-xl font-bold mb-6">다가오는 예약</h2>
          <div className="flex flex-col gap-6">
            {upcomingTrips.length > 0 ? (
              upcomingTrips.map(trip => (
                <TripCard key={trip.id} trip={trip} onCancel={handleCancelBooking} onOpenReceipt={openReceipt} />
              ))
            ) : (
              <div className="border border-dashed border-slate-200 rounded-2xl py-20 text-center text-slate-400">
                <Ghost className="mx-auto mb-2" size={24}/>
                예정된 여행이 없습니다.
              </div>
            )}
          </div>
        </section>

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