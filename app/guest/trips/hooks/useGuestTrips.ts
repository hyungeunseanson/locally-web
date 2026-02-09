'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { sendNotification } from '@/app/utils/notification';
import { useToast } from '@/app/context/ToastContext'; // 🟢 Toast 추가

export function useGuestTrips() {
  const [upcomingTrips, setUpcomingTrips] = useState<any[]>([]);
  const [pastTrips, setPastTrips] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const supabase = createClient();
  const { showToast } = useToast(); // 🟢 훅 사용

  const secureUrl = (url: string | null) => {
    if (!url) return null;
    return url.replace('http://', 'https://');
  };

  const fetchMyTrips = useCallback(async () => {
    try {
      setIsLoading(true);
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

      if (error) throw error;

      if (bookings) {
        const upcoming: any[] = [];
        const past: any[] = [];
        const today = new Date();
        today.setHours(0,0,0,0);

        bookings.forEach((booking: any) => {
          if (!booking.experiences) return;

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
            // 🟢 [중요] 갤러리를 위해 photos 배열 추가
            photos: booking.experiences.photos || [],
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
        setPastTrips(past.reverse());
      }
    } catch (err: any) {
      console.error(err);
      showToast('예약 정보를 불러오는데 실패했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  // 🟢 인자 3개 받음 (id, reason, hostId)
  const requestCancel = async (id: number, reason: string, hostId: string) => {
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

      // 호스트 알림
      if (hostId) {
        await sendNotification({
            recipient_id: hostId,
            type: 'booking_cancel_request', // 타입명 확인 필요 (DB에 맞게)
            content: '예약 취소 요청이 있습니다.',
            link_url: '/host/dashboard'
        });
      }

      showToast('취소 요청이 접수되었습니다.', 'success'); // alert -> Toast
      fetchMyTrips(); 
      return true; 

    } catch (err: any) {
      showToast('요청 실패: ' + err.message, 'error');
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
    // 🟢 이름 통일: requestCancel
    requestCancel,
    refreshTrips: fetchMyTrips
  };
}