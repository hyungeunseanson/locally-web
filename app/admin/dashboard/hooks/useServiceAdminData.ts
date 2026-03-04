'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import { AdminServiceBooking } from '@/app/types/admin';

const ITEMS_PER_PAGE = 50;

export function useServiceAdminData() {
  const { showToast } = useToast();
  const supabase = createClient();

  const [bookings, setBookings] = useState<AdminServiceBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Manual JOIN enrichment — same pattern as useAdminData.ts
  const enrichServiceBookings = async (rawBookings: any[]): Promise<AdminServiceBooking[]> => {
    if (!rawBookings || rawBookings.length === 0) return [];

    const requestIds = Array.from(new Set(rawBookings.map(b => b.request_id).filter(Boolean)));
    const customerIds = Array.from(new Set(rawBookings.map(b => b.customer_id).filter(Boolean)));
    const hostIds = Array.from(new Set(rawBookings.map(b => b.host_id).filter(Boolean) as string[]));

    const requestMap = new Map<string, any>();
    const customerMap = new Map<string, any>();
    const hostProfileMap = new Map<string, any>();
    const hostAppMap = new Map<string, any>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetches: PromiseLike<any>[] = [];

    if (requestIds.length > 0) {
      fetches.push(
        supabase
          .from('service_requests')
          .select('id, title, city, service_date, duration_hours, status')
          .in('id', requestIds)
          .then(({ data }) => {
            if (data) data.forEach(r => requestMap.set(r.id, r));
          })
      );
    }

    if (customerIds.length > 0) {
      fetches.push(
        supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', customerIds)
          .then(({ data }) => {
            if (data) data.forEach(p => customerMap.set(p.id, p));
          })
      );
    }

    if (hostIds.length > 0) {
      fetches.push(
        supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', hostIds)
          .then(({ data }) => {
            if (data) data.forEach(p => hostProfileMap.set(p.id, p));
          })
      );
      fetches.push(
        fetch(`/api/admin/host-applications?user_ids=${hostIds.join(',')}&select=user_id,name,bank_name,account_number,account_holder`)
          .then(r => r.ok ? r.json() : { data: [] })
          .then(({ data }) => {
            if (data) {
              data.forEach((a: any) => {
                if (!hostAppMap.has(a.user_id)) hostAppMap.set(a.user_id, a);
              });
            }
          })
      );
    }

    await Promise.all(fetches);

    return rawBookings.map(b => ({
      ...b,
      service_request: requestMap.get(b.request_id) ?? null,
      customer_profile: customerMap.get(b.customer_id) ?? null,
      host_profile: b.host_id ? (hostProfileMap.get(b.host_id) ?? null) : null,
      host_application: b.host_id ? (hostAppMap.get(b.host_id) ?? null) : null,
    }));
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: rawBookings, error } = await supabase
        .from('service_bookings')
        .select(
          'id, order_id, request_id, customer_id, host_id, amount, host_payout_amount, platform_revenue, status, payout_status, tid, payment_method, cancel_reason, refund_amount, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(ITEMS_PER_PAGE);

      if (error) throw error;

      const enriched = await enrichServiceBookings(rawBookings || []);
      setBookings(enriched);
    } catch (err: any) {
      console.error('[useServiceAdminData] fetch error:', err);
      showToast('맞춤 의뢰 데이터 로딩 실패', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [supabase, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { bookings, isLoading, refresh: fetchData };
}
