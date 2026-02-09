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

      // 1. 예약 정보와 연결된 체험 정보 조회
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          *,
          experiences (
            id, title, city, photos, address, host_id,
            profiles!experiences_host_id_fkey (*) 
          )
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: true });

      if (error) throw error;

      if (bookings) {
        // 2. 호스트 ID 추출 (중복 제거)
        const hostIds = Array.from(new Set(bookings.map((b: any) => b.experiences?.host_id).filter(Boolean)));
        
        // 3. [핵심 수정] 호스트 신청서(host_applications) 정보 추가 조회
        let appsMap = new Map();
        if (hostIds.length > 0) {
          const { data: apps } = await supabase
            .from('host_applications')
            .select('user_id, name, profile_photo')
            .in('user_id', hostIds);
            
          if (apps) {
            apps.forEach((app: any) => appsMap.set(app.user_id, app));
          }
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

          // 🟢 [우선순위 적용] 호스트 신청서 정보 > 프로필 정보 > 기본값
          const hostApp = appsMap.get(booking.experiences.host_id);
          
          const finalHostName = hostApp?.name || profileData?.name || profileData?.full_name || 'Locally Host';
          const finalHostAvatar = hostApp?.profile_photo || profileData?.avatar_url;

          const formattedTrip = {
            id: booking.id,
            title: booking.experiences.title,
            
            // 수정된 호스트 정보 적용
            hostName: finalHostName,
            hostAvatar: secureUrl(finalHostAvatar),
            hostPhone: profileData?.phone, // 전화번호는 프로필에서 유지
            hostId: booking.experiences.host_id,
            
            date: booking.date, 
            time: booking.time || '시간 미정',
            location: booking.experiences.city || '서울',
            address: booking.experiences.address || booking.experiences.city,
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

  const requestCancel = async (id: number, reason: string, hostId: string) => {
    setIsProcessing(true);
    try {
      const { error } = await supabase.from('bookings').update({ status: 'cancellation_requested', cancel_reason: reason }).eq('id', id);
      if (error) throw error;
      if (hostId) await sendNotification({ recipient_id: hostId, type: 'booking_cancel_request', content: '예약 취소 요청이 있습니다.', link_url: '/host/dashboard' });
      showToast('취소 요청이 접수되었습니다.', 'success');
      fetchMyTrips(); 
      return true; 
    } catch (err: any) {
      showToast('요청 실패: ' + err.message, 'error');
      return false; 
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => { fetchMyTrips(); }, [fetchMyTrips]);

  return { upcomingTrips, pastTrips, isLoading, isProcessing, requestCancel, refreshTrips: fetchMyTrips };
}