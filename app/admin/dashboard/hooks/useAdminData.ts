'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import { updateAdminStatus } from '@/app/actions/admin';
import { AdminDashboardState, AdminBooking } from '@/app/types/admin';

const ITEMS_PER_PAGE = 20;

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

  const [bookingPage, setBookingPage] = useState(0);
  const [hasMoreBookings, setHasMoreBookings] = useState(true);
  const [isBookingLoading, setIsBookingLoading] = useState(false);

  // 🛠️ 데이터 조립 함수 (Manual Join)
  const enrichBookings = async (rawBookings: any[]) => {
    if (!rawBookings || rawBookings.length === 0) return [];

    const expIds = Array.from(new Set(rawBookings.map((b: any) => b.experience_id).filter(Boolean)));
    const userIds = Array.from(new Set(rawBookings.map((b: any) => b.user_id).filter(Boolean)));

    let expMap = new Map();
    if (expIds.length > 0) {
      const { data: exps } = await supabase.from('experiences').select('id, title, host_id').in('id', expIds);
      if (exps) {
        const hostIds = exps.map((e: any) => e.host_id).filter(Boolean);
        userIds.push(...hostIds); // 호스트 ID도 유저 목록에 추가
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

    return rawBookings.map((b: any) => {
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
  };

  const fetchInitialData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      setBookingPage(0);
      setHasMoreBookings(true);

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
        supabase.from('bookings')
          .select('*')
          .order('created_at', { ascending: false })
          .range(0, ITEMS_PER_PAGE - 1) // 🟢 초기 로딩: 0 ~ 19 (20개)
      ]);

      if (bookingError) throw bookingError;

      const enrichedBookings = await enrichBookings(bookingRawData || []);

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
      showToast('데이터 로딩 중 오류 발생', 'error');
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [supabase, showToast]);

  // 🟢 더보기 (Load More) 기능 구현
  const loadMoreBookings = async () => {
    if (isBookingLoading || !hasMoreBookings) return;
    
    setIsBookingLoading(true);
    const nextPage = bookingPage + 1;
    const from = nextPage * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    try {
      const { data: moreBookings, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      if (!moreBookings || moreBookings.length < ITEMS_PER_PAGE) {
        setHasMoreBookings(false); // 더 이상 데이터 없음
      }

      if (moreBookings && moreBookings.length > 0) {
        const enrichedMore = await enrichBookings(moreBookings);
        setState(prev => ({
          ...prev,
          bookings: [...prev.bookings, ...enrichedMore] // 기존 목록 뒤에 추가
        }));
        setBookingPage(nextPage);
      }
    } catch (err) {
      console.error(err);
      showToast('추가 데이터 로딩 실패', 'error');
    } finally {
      setIsBookingLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();

    // 실시간 채널 설정
    const presenceChannel = supabase.channel('online_users')
      .on('presence', { event: 'sync' }, () => {
        const newState = presenceChannel.presenceState();
        const users = Object.values(newState).flat();
        const uniqueUsers = Array.from(new Map(users.map((u: any) => [u.user_id, u])).values());
        setState(prev => ({ ...prev, onlineUsers: uniqueUsers }));
      }).subscribe();

    const bookingChannel = supabase.channel('realtime_bookings')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings' }, async (payload) => {
        // 🟢 새 예약이 오면 맨 앞에 추가 (전체 리로드 방지)
        const newBookingRaw = payload.new;
        const enriched = await enrichBookings([newBookingRaw]);
        
        setState(prev => ({
          ...prev,
          bookings: [...enriched, ...prev.bookings]
        }));
        showToast('🔔 새로운 예약이 접수되었습니다!', 'success');
      }).subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(bookingChannel);
    };
  }, [supabase, fetchInitialData, showToast]);

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
      fetchInitialData(); // 상태 변경 시 리프레시
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
      
      // 로컬 상태에서 즉시 제거 (리로드 없이)
      if (table === 'users') {
        setState(prev => ({ ...prev, users: prev.users.filter((u:any) => u.id !== id) }));
      } else {
        fetchInitialData();
      }
    } catch (err: any) {
      showToast('삭제 실패: ' + err.message, 'error');
    }
  };

  return {
    ...state,
    updateStatus,
    deleteItem,
    refresh: fetchInitialData,
    loadMoreBookings, // 🟢 추가된 함수
    hasMoreBookings,  // 🟢 추가된 상태
    isBookingLoading  // 🟢 추가된 상태
  };
}
