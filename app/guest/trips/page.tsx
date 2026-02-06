'use client';

import React, { useEffect, useState } from 'react';
import { 
  Calendar, MapPin, MoreHorizontal, MessageSquare, Receipt, Ghost, Lock, Loader2, X, Share2, Map, Clock, CheckCircle2
} from 'lucide-react';
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
      if (!user) return; // 로그인 안 된 경우

      // ✅ [핵심] 진짜 데이터 가져오기 (bookings + experiences + profiles 조인)
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          *,
          experiences (
            id, title, city, photos, address, host_id,
            profiles:host_id (name, phone)
          )
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: true });

      if (error) {
        console.error("데이터 로딩 에러:", error);
        return;
      }

      if (bookings) {
        const upcoming: any[] = [];
        const past: any[] = [];
        const today = new Date();
        today.setHours(0,0,0,0);

        bookings.forEach((booking: any) => {
          const tripDate = new Date(booking.date);
          const isFuture = tripDate >= today && booking.status !== 'cancelled';
          
          // D-Day 계산
          const diffTime = tripDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          const dDay = isFuture ? (diffDays === 0 ? 'D-Day' : `D-${diffDays}`) : null;

          const formattedTrip = {
            id: booking.id,
            title: booking.experiences?.title || '체험 정보 불러오는 중...',
            hostName: booking.experiences?.profiles?.name || 'Locally Host',
            hostPhone: booking.experiences?.profiles?.phone || '연락처 미공개',
            hostId: booking.experiences?.host_id,
            date: booking.date, 
            time: booking.time || '14:00',
            location: booking.experiences?.city || '서울',
            address: booking.experiences?.address || booking.experiences?.city || '주소 정보 없음',
            image: booking.experiences?.photos?.[0],
            dDay: dDay,
            isPrivate: booking.type === 'private',
            status: booking.status,
            price: booking.amount || booking.total_price || 0,
            guests: booking.guests || 1,
            expId: booking.experience_id,
            orderId: booking.order_id || booking.id.substring(0,8).toUpperCase(),
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

  const openReceipt = (trip: any) => { setSelectedTrip(trip); setIsReceiptModalOpen(true); };
  const openReview = (trip: any) => { setSelectedTrip(trip); setIsReviewModalOpen(true); };

  if (isLoading) return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" size={32} /></div>;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />

      <main className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black mb-10">나의 여행</h1>

        {/* 1. 예정된 예약 */}
        <section className="mb-20">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            다가오는 예약 <span className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded-full">{upcomingTrips.length}</span>
          </h2>
          
          <div className="flex flex-col gap-6">
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
              <div className="border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center py-20 px-4 bg-slate-50 text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                  <Ghost size={24} className="text-slate-300"/>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">아직 예정된 여행이 없습니다</h3>
                <Link href="/" className="mt-4 px-6 py-3 bg-black text-white rounded-xl font-bold text-sm hover:scale-105 transition-transform">
                  체험 둘러보기
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* 2. 지난 여행 */}
        <section>
          <h2 className="text-xl font-bold mb-6 text-slate-400">지난 여행</h2>
          {pastTrips.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {pastTrips.map(trip => (
                <div key={trip.id} className="border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg transition-all bg-white group flex flex-col p-5">
                    <div className="font-bold mb-1 truncate text-slate-900">{trip.title}</div>
                    <div className="text-xs text-slate-500 mb-4">{trip.date}</div>
                    {trip.status !== 'cancelled' && (
                      <button onClick={() => openReview(trip)} className="text-xs font-bold underline text-left hover:text-blue-600">
                        후기 작성
                      </button>
                    )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-400 text-sm py-10">다녀온 여행이 없습니다.</div>
          )}
        </section>
      </main>

      {/* 모달 */}
      {isReceiptModalOpen && selectedTrip && <ReceiptModal trip={selectedTrip} onClose={() => setIsReceiptModalOpen(false)} />}
      {isReviewModalOpen && selectedTrip && <ReviewModal trip={selectedTrip} onClose={() => setIsReviewModalOpen(false)} />}
    </div>
  );
}