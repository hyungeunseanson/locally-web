'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Ghost } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import ReviewModal from '@/app/components/ReviewModal';
import TripCard from './components/TripCard';     // ✅ 분리된 컴포넌트 import
import ReceiptModal from './components/ReceiptModal'; // ✅ 분리된 컴포넌트 import

export default function GuestTripsPage() {
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

      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          *,
          experiences (
            id, title, city, photos, address, host_id, profiles:host_id (name, phone)
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
            hostName: booking.experiences?.profiles?.name || 'Locally Host',
            hostPhone: booking.experiences?.profiles?.phone || '연락처 미공개',
            hostId: booking.experiences?.host_id,
            date: booking.date, 
            time: booking.time || '14:00',
            location: booking.experiences?.city || '서울',
            address: booking.experiences?.address || booking.experiences?.city,
            image: booking.experiences?.photos?.[0],
            dDay: dDay,
            isPrivate: booking.type === 'private',
            status: booking.status,
            price: booking.amount || booking.total_price || 0,
            guests: booking.guests || 1,
            expId: booking.experience_id,
            orderId: booking.order_id || `ORD-${booking.id.substring(0,8).toUpperCase()}`,
            userName: user.user_metadata?.name || 'Guest',
          };

          if (isFuture) upcoming.push(formattedTrip);
          else past.push(formattedTrip);
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

  const handleCancelBooking = async (id: number) => {
    if (!confirm('정말 예약을 취소하시겠습니까?')) return;
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
    if (!error) { alert('예약이 취소되었습니다.'); fetchMyTrips(); } 
    else { alert('취소 실패: ' + error.message); }
  };

  const openReceipt = (trip: any) => { setSelectedTrip(trip); setIsReceiptModalOpen(true); };
  const openReview = (trip: any) => { setSelectedTrip(trip); setIsReviewModalOpen(true); };

  if (isLoading) return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" size={32} /></div>;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black mb-10">나의 여행</h1>

        {/* 1. 예정된 예약 */}
        <section className="mb-16">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            다가오는 예약 <span className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded-full">{upcomingTrips.length}</span>
          </h2>
          
          <div className="grid gap-6">
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
              <EmptyState />
            )}
          </div>
        </section>

        {/* 2. 지난 여행 */}
        <section>
          <h2 className="text-xl font-bold mb-6 text-slate-400">지난 여행</h2>
          {pastTrips.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {pastTrips.map(trip => (
                <div key={trip.id} className="border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg transition-all bg-white group flex flex-col">
                    <div className="h-32 bg-slate-200 relative overflow-hidden">
                        {trip.image && <img src={trip.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform"/>}
                        {trip.status === 'cancelled' && <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold backdrop-blur-sm text-sm">취소된 예약</div>}
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="font-bold mb-1 truncate text-slate-900 text-sm">{trip.title}</div>
                          <div className="text-xs text-slate-500 mb-4">{trip.date}</div>
                        </div>
                        {trip.status !== 'cancelled' && (
                          <button onClick={() => openReview(trip)} className="w-full border border-slate-200 text-slate-600 text-xs font-bold py-2 rounded-lg hover:bg-slate-900 hover:text-white transition-colors">
                            후기 작성
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

      {/* 모달들 */}
      {isReceiptModalOpen && selectedTrip && <ReceiptModal trip={selectedTrip} onClose={() => setIsReceiptModalOpen(false)} />}
      {isReviewModalOpen && selectedTrip && <ReviewModal trip={selectedTrip} onClose={() => setIsReviewModalOpen(false)} />}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center py-12 px-4 bg-slate-50/50 text-center">
      <Ghost size={32} className="text-slate-300 mb-4"/>
      <h3 className="text-lg font-bold text-slate-900 mb-1">예정된 여행이 없습니다.</h3>
      <Link href="/" className="mt-4 px-6 py-3 bg-black text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors">
        체험 둘러보기
      </Link>
    </div>
  );
}