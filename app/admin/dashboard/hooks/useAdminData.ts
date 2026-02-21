'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import { updateAdminStatus, deleteAdminItem as deleteAdminItemAction } from '@/app/actions/admin';
import { AdminDashboardState, AdminBooking } from '@/app/types/admin';

export function useAdminData() {
  const { showToast } = useToast();
  const supabase = createClient();

  const [state, setState] = useState<AdminDashboardState>({
    apps: [],
    exps: [],
    users: [],
    bookings: [],
    reviews: [],
    onlineUsers: [],
    isLoading: true,
  });

  const fetchData = useCallback(async () => {
    try {
      // 1. 기본 데이터 로드
      const [
        { data: appData },
        { data: expData },
        { data: userData },
        { data: reviewData },
        { data: bookingRawData, error: bookingError }
      ] = await Promise.all([
        supabase.from('host_applications').select('*').order('created_at', { ascending: false }),
        supabase.from('experiences').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('reviews').select('rating, experience_id, created_at'),
        supabase.from('bookings').select('*').order('created_at', { ascending: false }).limit(1000)
      ]);

      if (bookingError) throw bookingError;

      let enrichedBookings: AdminBooking[] = [];

      // 2. 부가 데이터 조립 (Manual Join - 400 에러 방지용 안전 로직)
      if (bookingRawData && bookingRawData.length > 0) {
        const expIds = Array.from(new Set(bookingRawData.map((b: any) => b.experience_id).filter(Boolean)));
        const userIds = Array.from(new Set(bookingRawData.map((b: any) => b.user_id).filter(Boolean)));

        let expMap = new Map();
        if (expIds.length > 0) {
          const { data: exps } = await supabase.from('experiences').select('id, title, host_id').in('id', expIds);
          if (exps) {
            const hostIds = exps.map((e: any) => e.host_id).filter(Boolean);
            userIds.push(...hostIds);
            expMap = new Map(exps.map((e: any) => [e.id, e]));
          }
        }

        let userMap = new Map();
        if (userIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds);
          if (profiles) {
            userMap = new Map(profiles.map((p: any) => [p.id, p]));
          }
        }

        enrichedBookings = bookingRawData.map((b: any) => {
          const exp = expMap.get(b.experience_id);
          const guest = userMap.get(b.user_id);
          const host = exp ? userMap.get(exp.host_id) : null;

          return {
            ...b,
            experiences: {
              title: exp?.title || 'Unknown Experience',
              host_id: exp?.host_id,
              profiles: { name: host?.name || 'Unknown Host' }
            },
            profiles: {
              email: guest?.email || 'No Email',
              name: guest?.name || 'No Name'
            }
          };
        });
      }

      setState(prev => ({
        ...prev,
        apps: appData || [],
        exps: expData || [],
        users: userData || [],
        bookings: enrichedBookings,
        reviews: reviewData || [],
        isLoading: false
      }));

    } catch (error: any) {
      console.error('Admin Data Fetch Error:', error);
      showToast('데이터를 불러오는 중 오류가 발생했습니다.', 'error');
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [supabase, showToast]);

  useEffect(() => {
    fetchData();

    // 실시간 채널 설정
    const presenceChannel = supabase.channel('online_users')
      .on('presence', { event: 'sync' }, () => {
        const newState = presenceChannel.presenceState();
        const users = Object.values(newState).flat();
        const uniqueUsers = Array.from(new Map(users.map((u: any) => [u.user_id, u])).values());
        setState(prev => ({ ...prev, onlineUsers: uniqueUsers }));
      }).subscribe();

    const bookingChannel = supabase.channel('realtime_bookings')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings' }, (payload) => {
        fetchData(); // 단순 push 대신 전체 다시 불러와서 정합성 유지
        showToast('🔔 새로운 예약이 접수되었습니다!', 'success');
      }).subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(bookingChannel);
    };
  }, [supabase, fetchData, showToast]);

  const updateStatus = async (table: 'host_applications' | 'experiences', id: string, status: string) => {
    let comment = '';
    let dbStatus = status;

    if (status === 'rejected' || status === 'revision') {
      const input = prompt(`Reason for [${status}]:`);
      if (input === null) return;
      comment = input;
    } else if (status === 'approved') {
      if (!confirm('Approve?')) return;
      if (table === 'experiences') dbStatus = 'active';
    }

    try {
      await updateAdminStatus(table, id, dbStatus, comment);
      showToast(`성공적으로 업데이트되었습니다. (${dbStatus})`, 'success');
      await fetchData();
    } catch (err: any) {
      showToast('업데이트 실패: ' + err.message, 'error');
    }
  };

  const deleteItem = async (table: string, id: string) => {
    if (!confirm('정말 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    try {
      const res = await fetch('/api/admin/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '삭제 요청 실패');
      showToast('삭제되었습니다.', 'success');
      await fetchData();
    } catch (err: any) {
      showToast('삭제 실패: ' + err.message, 'error');
    }
  };

  return {
    ...state,
    updateStatus,
    deleteItem,
    refresh: fetchData
  };
}
