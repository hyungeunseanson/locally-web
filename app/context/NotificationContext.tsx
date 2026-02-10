'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import { X, Bell, MessageSquare } from 'lucide-react';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

// 🟢 토스트 데이터 타입 정의
interface ToastData {
  title: string;
  message: string;
  link?: string;
  type: 'notification' | 'message';
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toast, setToast] = useState<ToastData | null>(null); // 🟢 토스트 상태 관리
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let channel: any = null;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. 기존 시스템 알림 가져오기
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) setNotifications(data);

      // 2. 통합 리얼타임 구독 (알림 + 채팅)
      channel = supabase
        .channel('global-notifications')
        // (A) 시스템 알림 구독
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload) => {
            const newNoti = payload.new as Notification;
            setNotifications((prev) => [newNoti, ...prev]);
            
            // 시스템 알림 토스트
            setToast({
              title: newNoti.title,
              message: newNoti.message,
              link: newNoti.link,
              type: 'notification'
            });
            
            // 5초 뒤 자동 삭제
            setTimeout(() => setToast(null), 5000);
          }
        )
        // (B) 채팅 메시지 구독 (테이블명: inquiry_messages)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'inquiry_messages' },
          async (payload) => {
            const newMsg = payload.new;

            // 1. 내가 보낸 메시지는 무시
            if (newMsg.sender_id === user.id) return;

            // 2. 현재 채팅방에 있다면 알림 무시 (선택 사항)
            // if (pathname.includes('/inbox') || pathname.includes('/dashboard')) return;

            // 3. 이 메시지가 나에게 온 것인지 확인 (inquiries 테이블 조회)
            const { data: inquiry } = await supabase
              .from('inquiries')
              .select('user_id, host_id')
              .eq('id', newMsg.inquiry_id)
              .single();

            // 내가 게스트거나 호스트인 채팅방일 때만 알림
            if (inquiry && (inquiry.user_id === user.id || inquiry.host_id === user.id)) {
                setToast({
                  title: '새로운 메시지 💬',
                  message: newMsg.content || '사진을 보냈습니다.',
                  link: inquiry.host_id === user.id ? '/host/dashboard?tab=chat' : '/guest/inbox', // 역할에 따라 이동 경로 다르게
                  type: 'message'
                });
                
                setTimeout(() => setToast(null), 5000);
            }
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, pathname]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = async (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  };

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead }}>
      {children}
      
      {/* 🟢 토스트 UI 렌더링 (이 부분이 중요!) */}
      {toast && (
        <div 
          className="fixed bottom-6 right-6 z-[9999] bg-white/90 backdrop-blur-sm border border-slate-200 shadow-2xl rounded-2xl p-4 w-80 animate-in slide-in-from-bottom-5 fade-in duration-300 cursor-pointer hover:scale-105 transition-transform"
          onClick={() => {
            if (toast.link) router.push(toast.link);
            setToast(null);
          }}
        >
          <div className="flex justify-between items-start gap-3">
            <div className={`p-2.5 rounded-full shrink-0 ${toast.type === 'message' ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
              {toast.type === 'message' ? <MessageSquare size={20} /> : <Bell size={20} />}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm text-slate-900 truncate">{toast.title}</h4>
              <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">{toast.message}</p>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); setToast(null); }} 
              className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
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