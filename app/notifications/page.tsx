'use client';

import React, { useState, useEffect } from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import { useNotification } from '@/app/context/NotificationContext';
import { 
  Bell, Check, Trash2, Calendar, MessageSquare, 
  Info, AlertTriangle, ChevronRight, X 
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import Skeleton from '@/app/components/ui/Skeleton';
import EmptyState from '@/app/components/EmptyState'; // EmptyState가 있다면 활용

export default function NotificationsPage() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [localNotifications, setLocalNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const router = useRouter();
  const supabase = createClient();

  // 초기 로딩 시 Context 데이터와 동기화 (또는 직접 fetch)
  useEffect(() => {
    // Context에 있는 알림을 로컬 상태로 가져옴
    setLocalNotifications(notifications);
    setIsLoading(false);
  }, [notifications]);

  // 알림 삭제 함수 (DB 영구 삭제)
  const deleteNotification = async (id: number) => {
    // UI 즉시 반영
    setLocalNotifications(prev => prev.filter(n => n.id !== id));
    
    try {
      await supabase.from('notifications').delete().eq('id', id);
    } catch (error) {
      console.error('삭제 실패:', error);
    }
  };

  // 알림 클릭 핸들러
  const handleNotificationClick = async (noti: any) => {
    if (!noti.is_read) {
      await markAsRead(noti.id);
    }
    if (noti.link) {
      router.push(noti.link);
    }
  };

  // 필터링된 목록
  const filteredList = localNotifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    return true;
  });

  // 알림 아이콘 결정 도우미
  const getIcon = (type: string) => {
    if (type.includes('booking')) return <Calendar size={18} className="text-blue-500"/>;
    if (type.includes('message')) return <MessageSquare size={18} className="text-indigo-500"/>;
    if (type.includes('cancel')) return <AlertTriangle size={18} className="text-orange-500"/>;
    return <Info size={18} className="text-slate-500"/>;
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      
      <main className="max-w-2xl mx-auto px-6 py-12">
        {/* 헤더 영역 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black mb-2 flex items-center gap-3">
              알림 센터
              {unreadCount > 0 && (
                <span className="bg-rose-500 text-white text-sm px-2.5 py-1 rounded-full font-bold animate-pulse">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="text-slate-500">예약, 메시지, 계정 관련 중요 알림을 확인하세요.</p>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => setFilter('all')} 
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${filter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              전체
            </button>
            <button 
              onClick={() => setFilter('unread')} 
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${filter === 'unread' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              안 읽음
            </button>
          </div>
        </div>

        {/* 액션 바 */}
        <div className="flex justify-end mb-4">
          <button 
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="text-sm font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Check size={16}/> 모두 읽음으로 표시
          </button>
        </div>

        {/* 알림 리스트 */}
        <div className="space-y-4">
          {isLoading ? (
            [1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)
          ) : filteredList.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50">
              <Bell size={48} className="mx-auto text-slate-300 mb-4"/>
              <h3 className="text-lg font-bold text-slate-400">새로운 알림이 없습니다.</h3>
              <p className="text-slate-400 text-sm mt-1">
                {filter === 'unread' ? '모든 알림을 확인하셨네요!' : '아직 받은 알림이 없습니다.'}
              </p>
            </div>
          ) : (
            filteredList.map((noti) => (
              <div 
                key={noti.id} 
                className={`relative group rounded-2xl p-5 border transition-all hover:shadow-md cursor-pointer ${
                  !noti.is_read 
                    ? 'bg-blue-50/50 border-blue-100 ring-1 ring-blue-100' 
                    : 'bg-white border-slate-100 hover:border-slate-200'
                }`}
                onClick={() => handleNotificationClick(noti)}
              >
                <div className="flex gap-4">
                  {/* 아이콘 박스 */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                    !noti.is_read ? 'bg-white shadow-sm' : 'bg-slate-100'
                  }`}>
                    {getIcon(noti.type)}
                  </div>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className={`font-bold text-base mb-1 ${!noti.is_read ? 'text-slate-900' : 'text-slate-600'}`}>
                        {noti.title}
                        {!noti.is_read && <span className="ml-2 w-2 h-2 inline-block bg-rose-500 rounded-full align-middle"></span>}
                      </h3>
                      <span className="text-xs text-slate-400 shrink-0 ml-2">
                        {new Date(noti.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className={`text-sm leading-relaxed line-clamp-2 ${!noti.is_read ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                      {noti.message}
                    </p>
                  </div>

                  {/* 화살표 (호버 시 표시) */}
                  <div className="hidden md:flex items-center text-slate-300 group-hover:text-slate-400 group-hover:translate-x-1 transition-all">
                    <ChevronRight size={20}/>
                  </div>
                </div>

                {/* 삭제 버튼 (우측 상단, 그룹 호버 시 노출) */}
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteNotification(noti.id); }}
                  className="absolute top-4 right-4 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                  title="알림 삭제"
                >
                  <Trash2 size={16}/>
                </button>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}