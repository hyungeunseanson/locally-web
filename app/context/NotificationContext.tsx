'use client';

import React, { createContext, useContext, useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { X, Bell, MessageSquare } from 'lucide-react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@/app/context/AuthContext';

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
const NOTIFICATION_SELECT_COLUMNS = 'id, user_id, type, title, message, link, is_read, created_at';
const TOAST_DURATION_MS = 5000;
const VISIBILITY_SYNC_MIN_INTERVAL_MS = 2500;
const HOST_STATUS_REFRESH_NOTIFICATION_TYPES = new Set([
  'host_application_approved',
  'application_status_changed',
]);

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
  const { user, refreshHostStatus } = useAuth();

  const channelRef = useRef<RealtimeChannel | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncPromiseRef = useRef<Promise<void> | null>(null);
  const syncingUserIdRef = useRef<string | null>(null);
  const lastSyncAtRef = useRef(0);
  const currentUserIdRef = useRef<string | null>(null);
  const currentUserId = user?.id ?? null;

  const showToast = useCallback((payload: NotificationDB) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    setToast({
      title: payload.title,
      message: payload.message,
      link: payload.link,
      type: payload.type.includes('message') ? 'message' : 'notification',
    });

    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, TOAST_DURATION_MS);
  }, []);

  const refreshHostStatusIfNeeded = useCallback((notificationType: string | null | undefined) => {
    if (!notificationType || !HOST_STATUS_REFRESH_NOTIFICATION_TYPES.has(notificationType)) {
      return;
    }

    void refreshHostStatus();
  }, [refreshHostStatus]);

  const syncNotifications = useCallback((userId: string) => {
    if (syncPromiseRef.current && syncingUserIdRef.current === userId) {
      return syncPromiseRef.current;
    }

    syncingUserIdRef.current = userId;
    const currentSync = (async () => {
      const { data } = await supabase
        .from('notifications')
        .select(NOTIFICATION_SELECT_COLUMNS)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!data) return;

      lastSyncAtRef.current = Date.now();
      setNotifications(data);

      const cursor = sessionStorage.getItem('lastSeenNotiCreatedAt');

      if (!cursor) {
        sessionStorage.setItem(
          'lastSeenNotiCreatedAt',
          data.length > 0 ? data[0].created_at : new Date().toISOString()
        );
        return;
      }

      const newlySeenNotifications = data.filter(
        (notification) => new Date(notification.created_at) > new Date(cursor)
      );

      const candidate = newlySeenNotifications[0];

      if (!candidate) return;

      sessionStorage.setItem('lastSeenNotiCreatedAt', data[0].created_at);
      showToast(candidate);
      if (newlySeenNotifications.some((notification) => HOST_STATUS_REFRESH_NOTIFICATION_TYPES.has(notification.type))) {
        void refreshHostStatus();
      }

      if (candidate.type === 'booking_confirmed' && candidate.link === '/guest/trips') {
        queryClient.invalidateQueries({ queryKey: ['guestTrips'] });
      }
    })().finally(() => {
      if (syncPromiseRef.current === currentSync) {
        syncPromiseRef.current = null;
      }
      if (syncingUserIdRef.current === userId) {
        syncingUserIdRef.current = null;
      }
    });

    syncPromiseRef.current = currentSync;
    return currentSync;
  }, [supabase, queryClient, refreshHostStatus, showToast]);

  useEffect(() => {
    const setupRealtime = async () => {
      if (!currentUserId) {
        currentUserIdRef.current = null;
        setNotifications([]);
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
        return;
      }

      currentUserIdRef.current = currentUserId;
      await syncNotifications(currentUserId);

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      channelRef.current = supabase
        .channel('global-alerts')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUserId}` },
          (payload) => {
            const newNoti = payload.new as NotificationDB;
            if (newNoti.user_id !== currentUserId) return;

            setNotifications((prev) => {
              if (prev.some((notification) => notification.id === newNoti.id)) {
                return prev;
              }
              return [newNoti, ...prev];
            });

            lastSyncAtRef.current = Date.now();
            sessionStorage.setItem('lastSeenNotiCreatedAt', newNoti.created_at);
            showToast(newNoti);
            refreshHostStatusIfNeeded(newNoti.type);

            if (newNoti.type === 'booking_confirmed' && newNoti.link === '/guest/trips') {
              queryClient.invalidateQueries({ queryKey: ['guestTrips'] });
            }
          }
        )
        .subscribe();
    };

    void setupRealtime();

    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return;
      if (syncPromiseRef.current) return;
      if (Date.now() - lastSyncAtRef.current < VISIBILITY_SYNC_MIN_INTERVAL_MS) return;

      if (currentUserId) {
        currentUserIdRef.current = currentUserId;
        await syncNotifications(currentUserId);
        return;
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [currentUserId, queryClient, refreshHostStatusIfNeeded, showToast, supabase, syncNotifications]);

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
