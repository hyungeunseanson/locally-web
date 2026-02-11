'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { sendNotification } from '@/app/utils/notification';
import { useToast } from '@/app/context/ToastContext';

export function useGuestTrips() {
  const [upcomingTrips, setUpcomingTrips] = useState<any[]>([]);
  const [pastTrips, setPastTrips] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const supabase = createClient();
  const { showToast } = useToast();

  const secureUrl = (url: string | null) => {
    if (!url) return null;
    return url.replace('http://', 'https://');
  };

  const fetchMyTrips = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsLoading(false); return; }

      // 1. 예약 정보와 체험 정보 조회
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          *,
          experiences (
            id, title, city, photos, address, host_id,
            profiles!experiences_host_id_fkey (*) 
          ),
          reviews(id) 
        `) 
        .eq('user_id', user.id)
        .order('date', { ascending: true });

      if (error) throw error;

      if (bookings) {
        const hostIds = Array.from(new Set(bookings.map((b: any) => b.experiences?.host_id).filter(Boolean)));
        let appsMap = new Map();
        if (hostIds.length > 0) {
          const { data: apps } = await supabase.from('host_applications').select('user_id, name, profile_photo').in('user_id', hostIds);
          if (apps) apps.forEach((app: any) => appsMap.set(app.user_id, app));
        }

        const upcoming: any[] = [];
        const past: any[] = [];
        const today = new Date();
        today.setHours(0,0,0,0);

        bookings.forEach((booking: any) => {
          if (!booking.experiences) return;

          const [year, month, day] = booking.date.split('-').map(Number);
          const tripDate = new Date(year, month - 1, day);
          const isFuture = tripDate >= today; 

          const profileData = Array.isArray(booking.experiences.profiles) 
            ? booking.experiences.profiles[0] 
            : booking.experiences.profiles;

          const hostApp = appsMap.get(booking.experiences.host_id);
          const finalHostName = hostApp?.name || profileData?.name || profileData?.full_name || 'Locally Host';
          const finalHostAvatar = hostApp?.profile_photo || profileData?.avatar_url;

          const formattedTrip = {
            id: booking.id,
            title: booking.experiences.title,
            hostName: finalHostName,
            hostAvatar: secureUrl(finalHostAvatar),
            hostPhone: profileData?.phone,
            hostId: booking.experiences.host_id,
            date: booking.date, 
            time: booking.time || '시간 미정',
            location: booking.experiences.city || '서울',
            address: booking.experiences.address || booking.experiences.city,
            photos: booking.experiences.photos?.map((p: string) => secureUrl(p)) || [],
            image: secureUrl(booking.experiences.photos?.[0]), 
            dDay: isFuture ? `D-${Math.ceil((tripDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))}` : null,
            isPrivate: booking.type === 'private',
            status: booking.status,
            price: booking.amount || booking.total_price || 0,
            guests: booking.guests || 1,
            expId: booking.experience_id,
            orderId: booking.order_id || booking.id,
            paymentDate: booking.created_at,
            hasReview: booking.reviews && booking.reviews.length > 0
          };

          if (isFuture) upcoming.push(formattedTrip);
          else past.push(formattedTrip);
        });

        setUpcomingTrips(upcoming);
        setPastTrips(past.reverse());
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  // ✅ [수정 완료] 과도한 검증 로직 제거 + 알림 정상화
  const requestCancel = async (id: number, reason: string, hostId: string) => {
    setIsProcessing(true);
    try {
      // 1. DB 업데이트 (검증 로직 제거, 에러만 체크)
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancellation_requested', cancel_reason: reason })
        .eq('id', id);

      if (error) throw error;
      
      // 2. 호스트 알림 전송 (title 필수값 포함)
      if (hostId) {
        await sendNotification({ 
          recipient_id: hostId, 
          type: 'booking_cancel_request', 
          title: '예약 취소 요청', 
          content: '게스트가 예약 취소를 요청했습니다.', 
          link_url: '/host/dashboard?tab=cancelled' 
        });
      }

      showToast('취소 요청이 접수되었습니다.', 'success');
      
      // 3. 목록 새로고침 (즉시 UI 반영)
      await fetchMyTrips(); 
      return true; 

    } catch (err: any) {
      console.error('취소 요청 오류:', err);
      showToast('요청 실패: ' + err.message, 'error');
      return false; 
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => { fetchMyTrips(); }, [fetchMyTrips]);

  return { upcomingTrips, pastTrips, isLoading, isProcessing, requestCancel, refreshTrips: fetchMyTrips };
}