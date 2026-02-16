'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/app/context/ToastContext';

export function useGuestTrips() {
  const { showToast } = useToast();
  const [trips, setTrips] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false); // 취소 처리 중 상태

  const fetchTrips = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/guest/trips');
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);
      setTrips(data.trips || []);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  // 🟢 취소 요청 함수
  const requestCancel = async (bookingId: number, reason: string, hostId: string) => {
    if (!confirm('정말로 예약을 취소하시겠습니까?')) return false;
    
    setIsProcessing(true);
    try {
      const res = await fetch('/api/payment/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, reason, isHostCancel: false }), // 게스트 취소
      });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error);

      showToast('취소 요청이 접수되었습니다.', 'success');
      fetchTrips(); // 목록 새로고침
      return true;
    } catch (err: any) {
      showToast(`취소 실패: ${err.message}`, 'error');
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  // 🟢 데이터 분류 (현재 시간 기준이 아니라, API가 준 'status' 기준으로 분류)
  // completed 또는 cancelled는 '지난 여행'으로 간주
  const upcomingTrips = trips.filter(t => 
    t.status !== 'completed' && t.status !== 'cancelled' && t.status !== 'cancellation_requested'
  );
  
  const pastTrips = trips.filter(t => 
    t.status === 'completed' || t.status === 'cancelled' || t.status === 'cancellation_requested'
  );

  return {
    upcomingTrips,
    pastTrips,
    isLoading,
    errorMsg,
    requestCancel,
    isProcessing,
    refreshTrips: fetchTrips // 모달 닫힐 때 등 재호출용
  };
}