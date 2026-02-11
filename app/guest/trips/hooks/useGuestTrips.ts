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
        // 호스트 신청서 정보 매핑
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
            photos: booking.experiences.photos || [],
            image: secureUrl(booking.experiences.photos?.[0]), 
            dDay: isFuture ? `D-${Math.ceil((tripDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))}` : null,
            isPrivate: booking.type === 'private',
            status: booking.status, // ✅ 상태값 확인 (여기가 바뀌어야 화면도 바뀜)
            price: booking.amount || booking.total_price || 0,
            guests: booking.guests || 1,
            expId: booking.experience_id,
            orderId: booking.order_id || booking.id.substring(0,8).toUpperCase(),
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

  // ✅ [수정됨] 취소 요청 로직 강화
  const requestCancel = async (id: number, reason: string, hostId: string) => {
    setIsProcessing(true);
    try {
      // 1. DB 업데이트 (상태 변경) 및 결과 확인 (.select() 추가)
      const { data, error } = await supabase
        .from('bookings')
        .update({ status: 'cancellation_requested', cancel_reason: reason })
        .eq('id', id)
        .select(); // 업데이트된 행 반환

      if (error) throw error;
      
      // 업데이트된 행이 없으면 실패로 간주
      if (!data || data.length === 0) {
        throw new Error('예약 정보를 찾을 수 없거나 변경 권한이 없습니다.');
      }

      // 2. 호스트에게 알림 전송 (title 추가하여 에러 방지)
      if (hostId) {
        await sendNotification({ 
          recipient_id: hostId, 
          type: 'booking_cancel_request', 
          title: '예약 취소 요청', // ✅ 필수값 추가
          content: '게스트가 예약 취소를 요청했습니다.', 
          link_url: '/host/dashboard?tab=reservations' 
        });
      }

      showToast('취소 요청이 접수되었습니다.', 'success');
      
      // 3. 목록 새로고침 (화면 갱신)
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