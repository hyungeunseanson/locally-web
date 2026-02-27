'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/app/context/ToastContext';
import { fetchGuestTrips, cancelGuestTrip } from '@/app/utils/api/trips';
import { isCancelledBookingStatus } from '@/app/constants/bookingStatus';

export function useGuestTrips() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // 🟢 1. React Query를 이용한 예약 내역 패칭 및 캐싱
  const { 
    data: trips = [], 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['guestTrips'], // 캐시 키
    queryFn: fetchGuestTrips, // 분리한 API 함수 호출
  });

  // 🟢 2. React Query Mutation을 이용한 취소 로직 처리
  const cancelMutation = useMutation({
    mutationFn: cancelGuestTrip,
    onSuccess: () => {
      showToast('취소 요청이 접수되었습니다.', 'success');
      // 취소 성공 시 캐시를 무효화하여 목록을 즉시(자동으로) 새로고침
      queryClient.invalidateQueries({ queryKey: ['guestTrips'] });
    },
    onError: (err: any) => {
      showToast(`취소 실패: ${err.message}`, 'error');
    }
  });

  // 🟢 3. 기존 UI 컴포넌트와 연결되는 함수 (기존 구조 100% 유지)
  const requestCancel = async (bookingId: number, reason: string, hostId: string) => {
    if (!confirm('정말로 예약을 취소하시겠습니까?')) return false;
    
    try {
      await cancelMutation.mutateAsync({ bookingId, reason });
      return true;
    } catch (err) {
      return false; // 에러 토스트는 onError에서 처리됨
    }
  };

  const isCompletedStatus = (status: string) => (status || '').toLowerCase() === 'completed';

  // 🟢 4. 데이터 분류 (기존 로직 유지)
  const upcomingTrips = trips.filter((t: any) => 
    !isCompletedStatus(t.status) && !isCancelledBookingStatus(t.status || '')
  );
  
  const pastTrips = trips.filter((t: any) => 
    isCompletedStatus(t.status) || isCancelledBookingStatus(t.status || '')
  );

  return {
    upcomingTrips,
    pastTrips,
    isLoading,
    errorMsg: error ? error.message : '',
    requestCancel,
    isProcessing: cancelMutation.isPending, // 취소 버튼 로딩 상태 자동 연동
    refreshTrips: refetch // 모달 등에서 명시적 새로고침 필요 시 사용
  };
}
