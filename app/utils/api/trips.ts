// app/utils/api/trips.ts

import type { GuestTrip } from '@/app/guest/trips/components/TripCard';

export type GuestTripsResponse = {
  trips: GuestTrip[];
  syncCompletedNeeded: boolean;
};

// 1. 게스트 예약 내역 불러오기
export const fetchGuestTrips = async (): Promise<GuestTripsResponse> => {
    const res = await fetch('/api/guest/trips');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '예약 내역을 불러오는데 실패했습니다.');
    return {
      trips: data.trips || [],
      syncCompletedNeeded: Boolean(data.syncCompletedNeeded),
    };
  };

export const syncCompletedGuestTrips = async () => {
  const res = await fetch('/api/guest/trips/sync-completed', {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '지난 예약 상태 동기화에 실패했습니다.');
  return {
    updatedCount: typeof data.updatedCount === 'number' ? data.updatedCount : 0,
    updatedIds: Array.isArray(data.updatedIds) ? data.updatedIds : [],
  };
};
  
  // 2. 예약 취소 요청
  export const cancelGuestTrip = async ({ bookingId, reason }: { bookingId: number; reason: string }) => {
    const res = await fetch('/api/payment/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, reason, isHostCancel: false }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || '취소 요청에 실패했습니다.');
    return result;
  };
