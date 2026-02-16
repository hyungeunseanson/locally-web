'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';

export function useGuestTrips() {
  const [upcomingTrips, setUpcomingTrips] = useState<any[]>([]);
  const [pastTrips, setPastTrips] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // 🟢 [수정 1] page.tsx 에러 해결을 위한 상태 추가
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const supabase = createClient();
  const { showToast } = useToast();

  const secureUrl = (url: string | null) => {
    if (!url) return null;
    return url.replace('http://', 'https://');
  };

  const fetchMyTrips = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null); // 초기화

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsLoading(false); return; }

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
        // 호스트 정보 매핑 로직 유지
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

          // 🟢 [수정 2] 금액(amount)과 결제일(paymentDate) 명확히 매핑
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
            
            // 여기가 핵심: 0원 문제 해결
            amount: booking.amount, 
            totalPrice: booking.amount || booking.total_price || 0, 
            
            guests: booking.guests || 1,
            expId: booking.experience_id,
            orderId: booking.order_id || booking.id,
            paymentDate: booking.created_at, // 환불 계산 시 사용됨
            hasReview: booking.reviews && booking.reviews.length > 0
          };

          // 완료된 건이나 취소된 건은 과거 내역으로
          if (isFuture && booking.status !== 'cancelled' && booking.status !== 'cancellation_requested') {
             upcoming.push(formattedTrip);
          } else {
             // 미래 날짜라도 취소된 건은 지난 여행(또는 취소 내역)으로 보낼 수 있음
             // 현재 로직상 날짜 기준 분류 유지
             if(isFuture) upcoming.push(formattedTrip);
             else past.push(formattedTrip);
          }
        });

        setUpcomingTrips(upcoming);
        setPastTrips(past.reverse());
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message); // 에러 설정
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  // 🟢 [수정 3] API 호출 방식으로 변경 (환불 자동 계산 및 PG 연동)
  const requestCancel = async (id: number, reason: string, hostId: string) => {
    setIsProcessing(true);
    try {
      // API 호출
      const res = await fetch('/api/payment/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bookingId: id, 
          reason: reason, 
          isHostCancel: false 
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || '취소 요청에 실패했습니다.');
      }
      
      showToast('취소 처리가 완료되었습니다.', 'success');
      
      // 목록 새로고침
      await fetchMyTrips(); 
      return true; 

    } catch (err: any) {
      console.error('취소 요청 오류:', err);
      showToast(err.message || '요청 실패', 'error');
      return false; 
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => { fetchMyTrips(); }, [fetchMyTrips]);

  // 🟢 [수정 4] errorMsg 반환 추가
  return { 
    upcomingTrips, 
    pastTrips, 
    isLoading, 
    isProcessing, 
    errorMsg, // 반환
    requestCancel, 
    refreshTrips: fetchMyTrips 
  };
}