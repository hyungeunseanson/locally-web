'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/app/context/ToastContext';
import { AdminServiceBooking } from '@/app/types/admin';

export function useServiceAdminData() {
  const { showToast } = useToast();

  const [bookings, setBookings] = useState<AdminServiceBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/service-bookings');
      if (!res.ok) throw new Error('API query failed');
      const json = await res.json();

      if (!json.success) throw new Error(json.error || 'Fetch logic failed');

      // Map the backend unified keys to the expected AdminServiceBooking keys
      const mappedBookings: AdminServiceBooking[] = (json.data || []).map((b: any) => ({
        ...b,
        service_request: b.request,
        customer_profile: b.customer,
        host_profile: b.host,
        host_application: b.application
      }));

      setBookings(mappedBookings);
    } catch (err: any) {
      console.error('[useServiceAdminData] fetch error:', err);
      showToast('맞춤 의뢰 데이터 로딩 실패', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { bookings, isLoading, refresh: fetchData };
}
