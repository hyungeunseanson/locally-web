'use client';

import React, { createContext, useContext, useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { X, Bell, MessageSquare } from 'lucide-react';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface NotificationDB {
  id: number;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

type NotificationUI = NotificationDB;

interface ToastData {
  title: string;
  message: string;
  link?: string;
  type: 'notification' | 'message';
}

interface NotificationContextType {
  notifications: NotificationUI[];
  unreadCount: number;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

async function markNotificationsRead(params: { notificationId?: number; markAll?: boolean }) {
  const response = await fetch('/api/notifications/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const result = await response.json();
  if (!response.ok || !result?.success) {
    throw new Error(result?.error || '알림 읽음 처리에 실패했습니다.');
  }

  return {
    markedIds: Array.isArray(result.markedIds) ? (result.markedIds as number[]) : [],
    markedCount: typeof result.markedCount === 'number' ? result.markedCount : 0,
  };
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationUI[]>([]);
  const [toast, setToast] = useState<ToastData | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const queryClient = useQueryClient();

// 🟢 [추가] 채널 관리를 위해 useRef 사용 (구독 중복 방지)
const channelRef = useRef<RealtimeChannel | null>(null);

// 초기 로드 + 포그라운드 복귀 공용 알림 동기화 함수
const syncNotifications = useCallback(async (userId: string) => {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (!data) return;
  setNotifications(data);

  const cursor = sessionStorage.getItem('lastSeenNotiCreatedAt');

  // cursor가 없는 첫 진입: cursor만 초기화하고 토스트 없음
  // 알림 있음 → 최신 알림 시점, 알림 없음 → 현재 시각을 기준점으로 심어둠
  // (과거 알림을 신규로 오인하지 않고, 빈 함에서 첫 알림도 정상 감지하기 위해)
  if (!cursor) {
    sessionStorage.setItem(
      'lastSeenNotiCreatedAt',
      data.length > 0 ? data[0].created_at : new Date().toISOString()
    );
    return;
  }

  // cursor가 있는 경우에만: cursor 이후 신규 알림만 토스트 대상
  const candidate = data.find(n => new Date(n.created_at) > new Date(cursor));

  if (candidate) {
    sessionStorage.setItem('lastSeenNotiCreatedAt', data[0].created_at);
    setToast({
      title: candidate.title,
      message: candidate.message,
      link: candidate.link,
      type: candidate.type.includes('message') ? 'message' : 'notification'
    });
    setTimeout(() => setToast(null), 5000);

    // 놓친 booking_confirmed 알림이면 guestTrips 캐시도 무효화
    if (candidate.type === 'booking_confirmed' && candidate.link === '/guest/trips') {
      queryClient.invalidateQueries({ queryKey: ['guestTrips'] });
    }
  }
}, [supabase, queryClient]);

useEffect(() => {
  const setupRealtime = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. 초기 알림 동기화 (놓친 알림 보정 포함)
    await syncNotifications(user.id);

    // 🟢 이미 구독 중이면 해제 후 다시 구독 (중복 방지)
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    // 2. 리얼타임 구독 — notifications 테이블 INSERT만 감지 (서버사이드 user_id 필터)
    // (채팅 알림은 /api/inquiries/thread, /api/inquiries/message 서버 경로가 DB에 저장 후
    //  여기 Channel A가 감지하므로, inquiry_messages를 별도 구독할 필요 없음)
    channelRef.current = supabase
      .channel('global-alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const newNoti = payload.new as NotificationDB;
          if (newNoti.user_id !== user.id) return;

          setNotifications((prev) => [newNoti, ...prev]);
          sessionStorage.setItem('lastSeenNotiCreatedAt', newNoti.created_at);

          setToast({
            title: newNoti.title,
            message: newNoti.message,
            link: newNoti.link,
            type: newNoti.type.includes('message') ? 'message' : 'notification'
          });
          setTimeout(() => setToast(null), 5000);

          // booking_confirmed + /guest/trips 링크 조합에서만 캐시 무효화
          if (newNoti.type === 'booking_confirmed' && newNoti.link === '/guest/trips') {
            queryClient.invalidateQueries({ queryKey: ['guestTrips'] });
          }
        }
      )
      .subscribe();
  };

  setupRealtime();

  // 탭 백그라운드 → 포그라운드 복귀 시 놓친 알림 보정
  const handleVisibility = async () => {
    if (document.visibilityState !== 'visible') return;
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) await syncNotifications(currentUser.id);
  };
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    // 컴포넌트가 사라질 때만 채널 정리
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}, [supabase, syncNotifications, queryClient]); // 🟢 pathname 제거 (페이지 이동해도 연결 유지)

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = async (id: number) => {
    let rollbackSnapshot: NotificationUI[] | null = null;

    setNotifications((prev) => {
      rollbackSnapshot = prev;
      return prev.map((n) => (n.id === id ? { ...n, is_read: true } : n));
    });

    try {
      await markNotificationsRead({ notificationId: id });
    } catch (error) {
      console.error('[NotificationContext] markAsRead failed:', error);
      if (rollbackSnapshot) {
        setNotifications(rollbackSnapshot);
      }
    }
  };

  const markAllAsRead = async () => {
    let rollbackSnapshot: NotificationUI[] | null = null;

    setNotifications((prev) => {
      rollbackSnapshot = prev;
      return prev.map((n) => ({ ...n, is_read: true }));
    });

    try {
      await markNotificationsRead({ markAll: true });
    } catch (error) {
      console.error('[NotificationContext] markAllAsRead failed:', error);
      if (rollbackSnapshot) {
        setNotifications(rollbackSnapshot);
      }
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead }}>
      {children}

      {/* 🟢 [디자인 수정] 다크 모드 토스트 알림창 */}
      {toast && (
        <div
          className="fixed bottom-[188px] md:bottom-20 right-4 md:right-6 z-[10000] bg-slate-900/95 backdrop-blur-sm border border-slate-700 shadow-2xl rounded-2xl p-4 w-80 animate-in slide-in-from-bottom-5 fade-in duration-300 cursor-pointer hover:scale-105 transition-transform"
          onClick={() => {
            if (toast.link) router.push(toast.link);
            setToast(null);
          }}
        >
          <div className="flex justify-between items-start gap-3">
            {/* 아이콘: 어두운 배경에 맞게 색상 조정 */}
            <div className={`p-2.5 rounded-full shrink-0 ${toast.type === 'message' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-amber-500/20 text-amber-300'}`}>
              {toast.type === 'message' ? <MessageSquare size={20} /> : <Bell size={20} />}
            </div>

            {/* 텍스트: 흰색 및 밝은 회색으로 변경 */}
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm text-white truncate">{toast.title}</h4>
              <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">{toast.message}</p>
            </div>

            {/* 닫기 버튼: 흰색 호버 효과 */}
            <button
              onClick={(e) => { e.stopPropagation(); setToast(null); }}
              className="text-slate-500 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within a NotificationProvider');
  return context;
};
