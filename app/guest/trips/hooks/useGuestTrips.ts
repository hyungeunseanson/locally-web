'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { sendNotification } from '@/app/utils/notification';

export function useGuestTrips() {
  const [upcomingTrips, setUpcomingTrips] = useState<any[]>([]);
  const [pastTrips, setPastTrips] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const supabase = createClient();

  const secureUrl = (url: string | null) => {
    if (!url) return null;
    return url.replace('http://', 'https://');
  };

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
        setErrorMsg('예약 정보를 불러오는데 실패했습니다.');
        throw error;
      }

      if (bookings) {
        const upcoming: any[] = [];
        const past: any[] = [];
        const today = new Date();
        today.setHours(0,0,0,0);

        bookings.forEach((booking: any) => {
          if (!booking.experiences) return;

          // 날짜 비교 로직 수정
          const [year, month, day] = booking.date.split('-').map(Number);
          const tripDate = new Date(year, month - 1, day);
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
            time: booking.time || '시간 미정',
            location: booking.experiences.city || '서울',
            address: booking.experiences.address || booking.experiences.city,
            image: secureUrl(booking.experiences.photos?.[0]), 
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
        // ✅ 지난 여행은 최신순(역순)으로 정렬
        setPastTrips(past.reverse());
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  const requestCancellation = async (id: number, reason: string, hostId: string) => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: 'cancellation_requested', 
          cancel_reason: reason 
        })
        .eq('id', id);

      if (error) throw error;

      await sendNotification({
        supabase,
        userId: hostId, 
        type: 'booking_request',
        title: '예약 취소 요청',
        message: '게스트가 예약을 취소하고 싶어합니다. 사유를 확인해주세요.',
        link: '/host/dashboard?tab=reservations'
      });

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