'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/app/utils/supabase/client';

export function useGuestTrips() {
  const [upcomingTrips, setUpcomingTrips] = useState<any[]>([]);
  const [pastTrips, setPastTrips] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const supabase = createClient();

  const fetchMyTrips = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsLoading(false);
        return; 
      }

      // ✅ 검증된 쿼리 로직 (full_name 및 FK 명시)
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
        throw error;
      }

      if (bookings) {
        const upcoming: any[] = [];
        const past: any[] = [];
        const today = new Date();
        today.setHours(0,0,0,0);

        bookings.forEach((booking: any) => {
          if (!booking.experiences) return;

          const tripDate = new Date(booking.date);
          // 취소된 건은 과거 내역이나 별도 처리가 필요할 수 있으나, 여기선 미래 일정 로직에 따라 분류됨
          // (단, isFuture 체크 시 status가 'cancelled'면 false가 되어 past로 갈 수 있음)
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
  }, [supabase]);

  // ✅ 예약 취소 및 환불 기능 (API 연동)
  const cancelBooking = async (id: number) => {
    if (!confirm('정말 예약을 취소하고 환불받으시겠습니까?\n(취소 시 결제가 자동으로 환불됩니다)')) return;
    
    try {
      // 1. 환불 API 호출 (서버에서 나이스페이 취소 처리)
      const res = await fetch('/api/payment/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bookingId: id, 
          reason: '게스트 요청에 의한 예약 취소' 
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || '환불 처리에 실패했습니다.');
      }

      // 2. 성공 시 알림 및 목록 갱신
      alert('예약이 정상적으로 취소되고 환불되었습니다.');
      fetchMyTrips(); 

    } catch (err: any) {
      console.error('취소 에러:', err);
      alert(`취소 실패: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchMyTrips();
  }, [fetchMyTrips]);

  return {
    upcomingTrips,
    pastTrips,
    isLoading,
    errorMsg,
    cancelBooking,
    refreshTrips: fetchMyTrips
  };
}