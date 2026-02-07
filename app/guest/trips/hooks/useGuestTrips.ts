'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/app/utils/supabase/client';

export function useGuestTrips() {
  const [upcomingTrips, setUpcomingTrips] = useState<any[]>([]);
  const [pastTrips, setPastTrips] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false); // 로딩 상태 추가
  
  const supabase = createClient();

  const fetchMyTrips = useCallback(async () => {
    // ... (기존 fetchMyTrips 로직 100% 동일, 생략 없음) ...
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsLoading(false); return; }

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

      if (error) throw error;

      if (bookings) {
        const upcoming: any[] = [];
        const past: any[] = [];
        const today = new Date();
        today.setHours(0,0,0,0);

        bookings.forEach((booking: any) => {
          if (!booking.experiences) return;
          const tripDate = new Date(booking.date);
          
          // 💡 상태가 'cancelled'거나 'cancellation_requested'여도 목록엔 보여야 함
          const isFuture = tripDate >= today; 

          const hostData = Array.isArray(booking.experiences.profiles) ? booking.experiences.profiles[0] : booking.experiences.profiles;

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
            status: booking.status, // status 그대로 전달 (PAID, cancellation_requested 등)
            price: booking.amount,
            guests: booking.guests,
            orderId: booking.order_id,
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
  }, [supabase]);

  // ✅ [수정] 취소 요청 로직 (DB 업데이트만 수행)
  const requestCancellation = async (id: number, reason: string) => {
    setIsProcessing(true);
    try {
      // 1. bookings 테이블에 취소 요청 상태와 사유 업데이트
      // (cancel_reason 컬럼이 없다면 Supabase에서 추가해야 함, 혹은 admin_comment 등에 임시 저장)
      try {
        // ✅ [수정] cancel_reason 필드에 사유 저장 (주석 해제)
        const { error } = await supabase
          .from('bookings')
          .update({ 
            status: 'cancellation_requested', 
            cancel_reason: reason // 이 부분이 핵심입니다!
          })
          .eq('id', id);
  
        if (error) throw error;
  
        alert('취소 요청이 접수되었습니다.\n호스트 확인 후 환불이 진행됩니다.');
        fetchMyTrips(); 
        return true; 
  
      } catch (err: any) {
        alert('요청 실패: ' + err.message);
        return false; 
      } finally {
        setIsProcessing(false);
      }
    };

  useEffect(() => { fetchMyTrips(); }, [fetchMyTrips]);

  return { upcomingTrips, pastTrips, isLoading, isProcessing, requestCancellation, refreshTrips: fetchMyTrips };
}