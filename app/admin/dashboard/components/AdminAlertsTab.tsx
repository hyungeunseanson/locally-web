'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Briefcase, Check, ClipboardList, CreditCard, MessageSquare, Trash2 } from 'lucide-react';

import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import { getAdminNotificationCategory, isAdminAlertNotification } from '@/app/utils/adminNotifications';

type AdminNotificationItem = {
  id: number;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

function getNotificationIcon(notification: AdminNotificationItem) {
  const category = getAdminNotificationCategory(notification);

  if (category === 'messages') return <MessageSquare size={18} className="text-indigo-500" />;
  if (category === 'team') return <Briefcase size={18} className="text-emerald-500" />;
  if (category === 'services') return <ClipboardList size={18} className="text-orange-500" />;
  if (category === 'finance') return <CreditCard size={18} className="text-blue-500" />;
  return <Bell size={18} className="text-slate-500" />;
}

export default function AdminAlertsTab() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<number[]>([]);

  const fetchNotifications = useCallback(async () => {
    const response = await fetch('/api/admin/alerts', { cache: 'no-store' });
    const result = await response.json();

    if (!response.ok || result?.success === false) {
      throw new Error(result?.error || '관리자 알림을 불러오지 못했습니다.');
    }

    setNotifications(Array.isArray(result?.data) ? result.data : []);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (!user) {
        setNotifications([]);
        setIsLoading(false);
        return;
      }

      try {
        await fetchNotifications();
      } catch (error) {
        console.error('[AdminAlertsTab] fetch notifications failed:', error);
        if (isMounted) {
          setNotifications([]);
          showToast('관리자 알림을 불러오지 못했습니다.', 'error');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      channelRef.current = supabase
        .channel('admin-alerts-tab')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, (payload) => {
          const nextRow = payload.new as AdminNotificationItem | undefined;
          const prevRow = payload.old as AdminNotificationItem | undefined;
          const targetRow = nextRow || prevRow;

          if (!targetRow || targetRow.user_id !== user.id || !isAdminAlertNotification(targetRow)) {
            return;
          }

          if (payload.eventType === 'INSERT' && nextRow) {
            setNotifications((prev) => [nextRow, ...prev.filter((item) => item.id !== nextRow.id)].slice(0, 100));
            return;
          }

          if (payload.eventType === 'UPDATE' && nextRow) {
            setNotifications((prev) => prev.map((item) => (item.id === nextRow.id ? nextRow : item)));
            return;
          }

          if (payload.eventType === 'DELETE' && prevRow) {
            setNotifications((prev) => prev.filter((item) => item.id !== prevRow.id));
          }
        })
        .subscribe();
    };

    init();

    return () => {
      isMounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchNotifications, showToast, supabase]);

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;
  const filteredNotifications = notifications.filter((notification) => {
    if (filter === 'unread') return !notification.is_read;
    return true;
  });

  const handleClick = async (notification: AdminNotificationItem) => {
    if (!notification.is_read) {
      const previousNotifications = notifications;
      setNotifications((prev) => prev.map((item) => (
        item.id === notification.id ? { ...item, is_read: true } : item
      )));

      try {
        const response = await fetch(`/api/admin/alerts/${notification.id}`, {
          method: 'PATCH',
        });
        const result = await response.json();

        if (!response.ok || result?.success === false) {
          throw new Error(result?.error || '알림 읽음 처리 실패');
        }
      } catch (error) {
        console.error('[AdminAlertsTab] mark read failed:', error);
        setNotifications(previousNotifications);
        showToast('알림 읽음 처리에 실패했습니다.', 'error');
      }
    }

    if (notification.link && notification.link !== '/admin/dashboard?tab=ALERTS') {
      router.push(notification.link);
      return;
    }

    setExpandedIds((prev) => (
      prev.includes(notification.id)
        ? prev.filter((id) => id !== notification.id)
        : [...prev, notification.id]
    ));
  };

  const handleMarkAllRead = async () => {
    const unreadIds = notifications
      .filter((notification) => !notification.is_read)
      .map((notification) => notification.id);

    if (unreadIds.length === 0) return;

    const previousNotifications = notifications;
    setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })));

    try {
      const response = await fetch('/api/admin/alerts/read-all', {
        method: 'POST',
      });
      const result = await response.json();

      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || '전체 읽음 처리 실패');
      }
    } catch (error) {
      console.error('[AdminAlertsTab] mark all read failed:', error);
      setNotifications(previousNotifications);
      showToast('전체 읽음 처리에 실패했습니다.', 'error');
    }
  };

  const handleDelete = async (notificationId: number) => {
    const previousNotifications = notifications;
    setNotifications((prev) => prev.filter((notification) => notification.id !== notificationId));

    try {
      const response = await fetch(`/api/admin/alerts/${notificationId}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || '알림 삭제 실패');
      }
    } catch (error) {
      console.error('[AdminAlertsTab] delete notification failed:', error);
      setNotifications(previousNotifications);
      showToast('알림 삭제에 실패했습니다.', 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="border-b border-slate-200 pb-3 md:pb-4 mb-3 md:mb-4 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-[14px] md:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Bell size={18} className="text-slate-700" />
              Admin Alerts
              {unreadCount > 0 && (
                <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {unreadCount}
                </span>
              )}
            </h2>
            <p className="text-[11px] md:text-[13px] text-slate-500 mt-1">
              운영 관련 인앱 알림을 여기서 확인합니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 text-[11px] md:text-xs font-bold rounded-md transition-all ${filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-3 py-1.5 text-[11px] md:text-xs font-bold rounded-md transition-all ${filter === 'unread' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Unread
              </button>
            </div>

            <button
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
              className="text-[11px] md:text-[12px] font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Check size={12} /> Mark all read
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />
            <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />
            <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50">
            <Bell size={28} className="mx-auto text-slate-300 mb-2" />
            <h3 className="text-[13px] font-bold text-slate-400">No admin alerts yet.</h3>
            <p className="text-slate-400 text-[11px] mt-0.5">
              {filter === 'unread' ? '읽지 않은 운영 알림이 없습니다.' : '운영 알림이 여기에 쌓입니다.'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`relative group rounded-xl px-4 md:px-5 py-3 md:py-3.5 border transition-all cursor-pointer ${notification.is_read ? 'bg-white border-slate-100 hover:border-slate-200' : 'bg-blue-50/40 border-blue-100'}`}
              onClick={() => handleClick(notification)}
            >
              <div className="flex gap-3 items-start">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${notification.is_read ? 'bg-slate-100' : 'bg-white shadow-sm'}`}>
                  {getNotificationIcon(notification)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className={`font-semibold text-[12px] md:text-[14px] mb-0.5 ${notification.is_read ? 'text-slate-600' : 'text-slate-900'}`}>
                      {notification.title}
                      {!notification.is_read && <span className="ml-1.5 w-1.5 h-1.5 inline-block bg-rose-500 rounded-full align-middle" />}
                    </h3>
                    <span className="text-[10px] md:text-[11px] text-slate-400 shrink-0">
                      {new Date(notification.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>

                  <p className={`text-[11px] md:text-[13px] leading-relaxed whitespace-pre-wrap transition-all duration-300 ${expandedIds.includes(notification.id) ? '' : 'line-clamp-2'} ${notification.is_read ? 'text-slate-500' : 'text-slate-700 font-medium'}`}>
                    {notification.message}
                  </p>
                </div>
              </div>

              <button
                onClick={(event) => {
                  event.stopPropagation();
                  handleDelete(notification.id);
                }}
                className="absolute top-3 right-3 p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                title="Delete"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
