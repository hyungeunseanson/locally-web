'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/app/utils/supabase/client';

export function useGuestTrips() {
  const [upcomingTrips, setUpcomingTrips] = useState<any[]>([]);
  const [pastTrips, setPastTrips] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false); // 로딩 상태 추가
  const [errorMsg, setErrorMsg] = useState<string | null>(null); // 에러 메시지 상태 추가
  
  const supabase = createClient();

  const fetchMyTrips = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsLoading(false);
        return; 
      }

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
          // 여기서는 날짜 기준으로만 미래/과거를 나눕니다.
          const isFuture = tripDate >= today; 

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
            dDay: isFuture ? `D-${Math.ceil((tripDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))}` : null,
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

  // ✅ 예약 취소 요청 (DB 업데이트)
  const requestCancellation = async (id: number, reason: string) => {
    setIsProcessing(true);
    try {
      // 1. bookings 테이블에 취소 요청 상태와 사유 업데이트
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: 'cancellation_requested', 
          cancel_reason: reason 
        })
        .eq('id', id);

      if (error) throw error;

      alert('취소 요청이 접수되었습니다.\n호스트 확인 후 환불이 진행됩니다.');
      fetchMyTrips(); // 목록 갱신
      return true; // 성공

    } catch (err: any) {
      alert('요청 실패: ' + err.message);
      return false; // 실패
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    fetchMyTrips();
  }, [fetchMyTrips]);

  return {
    upcomingTrips,
    pastTrips,
    isLoading,
    isProcessing,
    errorMsg,
    requestCancellation,
    refreshTrips: fetchMyTrips
  };
}