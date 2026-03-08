'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';
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
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

// 🟢 [추가] 채널 관리를 위해 useRef 사용 (구독 중복 방지)
const channelRef = useRef<any>(null);

useEffect(() => {
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

    // 🟢 이미 구독 중이면 해제 후 다시 구독 (중복 방지)
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    // 2. 리얼타임 구독 — notifications 테이블 INSERT만 감지
    // (채팅 알림은 useChat.sendMessage()가 sendNotification()을 호출해 DB에 저장 후
    //  여기 Channel A가 감지하므로, inquiry_messages를 별도 구독할 필요 없음)
    channelRef.current = supabase
      .channel('global-alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const newNoti = payload.new as NotificationDB;
          if (newNoti.user_id !== user.id) return;

          setNotifications((prev) => [newNoti, ...prev]);

          setToast({
            title: newNoti.title,
            message: newNoti.message,
            link: newNoti.link,
            type: newNoti.type.includes('message') ? 'message' : 'notification'
          });
          setTimeout(() => setToast(null), 5000);
        }
      )
      .subscribe();
  };

  setupRealtime();

  return () => {
    // 컴포넌트가 사라질 때만 채널 정리
    if (channelRef.current) supabase.removeChannel(channelRef.current);
  };
}, [supabase]); // 🟢 pathname 제거 (페이지 이동해도 연결 유지)

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
      
      {/* 🟢 [디자인 수정] 다크 모드 토스트 알림창 */}
      {toast && (
        <div 
          className="fixed bottom-[80px] md:bottom-6 right-4 md:right-6 z-[9999] bg-slate-900/95 backdrop-blur-sm border border-slate-700 shadow-2xl rounded-2xl p-4 w-80 animate-in slide-in-from-bottom-5 fade-in duration-300 cursor-pointer hover:scale-105 transition-transform"
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
