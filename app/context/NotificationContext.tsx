'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import { X, Bell, MessageSquare } from 'lucide-react';

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

interface NotificationUI extends NotificationDB {}

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

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationUI[]>([]);
  const [toast, setToast] = useState<ToastData | null>(null);
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let channel: any = null;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. 초기 알림 로딩
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) setNotifications(data);

      // 2. 통합 리얼타임 구독
      channel = supabase
        .channel('global-alerts')
        // (A) 시스템 알림
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications' }, 
          (payload) => {
            const newNoti = payload.new as NotificationDB;
            if (newNoti.user_id !== user.id) return; 

            setNotifications((prev) => [newNoti, ...prev]);
            
            // 🟢 토스트 띄우기 (5초)
            setToast({
              title: newNoti.title,
              message: newNoti.message,
              link: newNoti.link,
              type: 'notification'
            });
            setTimeout(() => setToast(null), 5000);
          }
        )
        // (B) 채팅 메시지
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'inquiry_messages' },
          async (payload) => {
            const newMsg = payload.new;
            if (newMsg.sender_id === user.id) return; 

            // 채팅방 정보 확인
            const { data: inquiry } = await supabase
              .from('inquiries')
              .select('user_id, host_id')
              .eq('id', newMsg.inquiry_id)
              .single();

            if (inquiry && (inquiry.user_id === user.id || inquiry.host_id === user.id)) {
                const link = inquiry.host_id === user.id ? '/host/dashboard?tab=chat' : '/guest/inbox';
                
                // 🟢 토스트 띄우기 (5초)
                setToast({
                  title: '새로운 메시지 💬',
                  message: newMsg.content || '사진을 보냈습니다.',
                  link: link,
                  type: 'message'
                });
                setTimeout(() => setToast(null), 5000);

                // 알림 스택 추가
                const virtualNoti: NotificationUI = {
                  id: Date.now(),
                  user_id: user.id,
                  type: 'message',
                  title: '새로운 메시지',
                  message: newMsg.content || '사진을 보냈습니다.',
                  link: link,
                  is_read: false,
                  created_at: new Date().toISOString()
                };
                setNotifications((prev) => [virtualNoti, ...prev]);
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
    if (id < 1000000000000) { 
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    }
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
      
      {/* 🟢 [디자인 수정] 다크 모드 토스트 알림창 */}
      {toast && (
        <div 
          className="fixed bottom-6 right-6 z-[9999] bg-slate-900/95 backdrop-blur-sm border border-slate-700 shadow-2xl rounded-2xl p-4 w-80 animate-in slide-in-from-bottom-5 fade-in duration-300 cursor-pointer hover:scale-105 transition-transform"
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