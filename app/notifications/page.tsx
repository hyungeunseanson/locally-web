'use client';

import React, { useState, useEffect } from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import { useNotification } from '@/app/context/NotificationContext';
import {
  Bell, Check, Trash2, Calendar, MessageSquare,
  Info, AlertTriangle, ChevronRight, ArrowLeft
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import Skeleton from '@/app/components/ui/Skeleton';
import { useToast } from '@/app/context/ToastContext';
import { useLanguage } from '@/app/context/LanguageContext'; // 🟢 1. Import

export default function NotificationsPage() {
  const { t, lang } = useLanguage(); // 🟢 2. Hook (lang은 날짜 포맷용)
  const { showToast } = useToast();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [localNotifications, setLocalNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // 🟢 [추가] 펼쳐진 알림 ID 목록 (아코디언 기능용)
  const [expandedIds, setExpandedIds] = useState<number[]>([]);

  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const isHostNotifications = pathname?.startsWith('/host');

  // 🟢 [정석] Context(DB) 데이터와 동기화
  // 더 이상 booking 테이블을 직접 조회하지 않습니다.
  useEffect(() => {
    setLocalNotifications(notifications);
    setIsLoading(false);
  }, [notifications]);

  // 🟢 [정석] 알림 삭제 (DB에서 영구 삭제)
  const deleteNotification = async (id: number) => {
    // UI 즉시 반영 (낙관적 업데이트)
    setLocalNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await supabase.from('notifications').delete().eq('id', id);
    } catch (error) {
      console.error('삭제 실패:', error);
      showToast(t('noti_delete_fail'), 'error'); // 🟢 번역
      setLocalNotifications([...notifications]);
    }
  };

  const handleNotificationClick = async (noti: any) => {
    // 1. 읽음 처리 (화면 즉시 반영)
    if (!noti.is_read) {
      await markAsRead(noti.id);
      setLocalNotifications(prev => prev.map(n => n.id === noti.id ? { ...n, is_read: true } : n));
    }

    // 2. 링크가 있고, 그 링크가 '현재 페이지(/notifications)'가 아니면 이동
    // (예약, 메시지 등은 여기 걸려서 이동됨)
    const selfLinks = ['/notifications', '/host/notifications'];
    if (noti.link && !selfLinks.includes(noti.link)) {
      router.push(noti.link);
      return;
    }

    // 3. 링크가 없거나 현재 페이지면 내용 펼치기/접기 (관리자 공지 등)
    setExpandedIds(prev =>
      prev.includes(noti.id)
        ? prev.filter(id => id !== noti.id) // 닫기
        : [...prev, noti.id] // 펼치기
    );
  };

  const filteredList = localNotifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    return true;
  });

  const handleMobileBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(isHostNotifications ? '/host/menu' : '/account');
  };

  const getIcon = (type: string) => {
    if (type.includes('booking')) return <Calendar size={18} className="text-blue-500" />;
    if (type.includes('message')) return <MessageSquare size={18} className="text-indigo-500" />;
    if (type.includes('cancel')) return <AlertTriangle size={18} className="text-orange-500" />;
    return <Info size={18} className="text-slate-500" />;
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-12">
        <div className="md:hidden mb-3">
          <button
            onClick={handleMobileBack}
            className="h-9 w-9 rounded-full border border-slate-200 bg-white text-slate-700 flex items-center justify-center active:scale-95 transition-transform"
            aria-label="뒤로가기"
          >
            <ArrowLeft size={16} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-3">
          <div>
            <h1 className="text-[18px] md:text-2xl font-black mb-1 flex items-center gap-2">
              {t('noti_title')}
              {unreadCount > 0 && (
                <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="text-[11px] text-slate-500">{t('noti_desc')}</p>
          </div>

          <div className="flex gap-1.5">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${filter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              {t('noti_filter_all')}
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${filter === 'unread' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              {t('noti_filter_unread')}
            </button>
          </div>
        </div>

        <div className="flex justify-end mb-3">
          <button
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="text-[11px] font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Check size={12} /> {t('noti_mark_all_read')}
          </button>
        </div>

        <div className="space-y-2">
          {isLoading ? (
            [1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)
          ) : filteredList.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <Bell size={28} className="mx-auto text-slate-300 mb-2" />
              <h3 className="text-[13px] font-bold text-slate-400">{t('noti_empty_title')}</h3>
              <p className="text-slate-400 text-[11px] mt-0.5">
                {filter === 'unread' ? t('noti_empty_unread') : t('noti_empty_all')}
              </p>
            </div>
          ) : (
            filteredList.map((noti) => (
              <div
                key={noti.id}
                className={`relative group rounded-xl px-4 py-3 border transition-all cursor-pointer ${!noti.is_read
                    ? 'bg-blue-50/40 border-blue-100'
                    : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                onClick={() => handleNotificationClick(noti)}
              >
                <div className="flex gap-3 items-start">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${!noti.is_read ? 'bg-white shadow-sm' : 'bg-slate-100'
                    }`}>
                    {getIcon(noti.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className={`font-semibold text-[12px] mb-0.5 ${!noti.is_read ? 'text-slate-900' : 'text-slate-600'}`}>
                        {noti.title}
                        {!noti.is_read && <span className="ml-1.5 w-1.5 h-1.5 inline-block bg-rose-500 rounded-full align-middle"></span>}
                      </h3>
                      <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                        {new Date(noti.created_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : lang === 'en' ? 'en-US' : lang === 'ja' ? 'ja-JP' : 'zh-CN')}
                      </span>
                    </div>
                    <p className={`text-[11px] leading-relaxed whitespace-pre-wrap transition-all duration-300 ${expandedIds.includes(noti.id) ? '' : 'line-clamp-2'
                      } ${!noti.is_read ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                      {noti.message}
                    </p>
                  </div>

                  <div className="flex items-center text-slate-300 group-hover:text-slate-500 transition-all ml-1">
                    {noti.link && !['/notifications', '/host/notifications'].includes(noti.link) ? (
                      <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                    ) : (
                      <ChevronRight size={14} className={`transition-transform duration-300 ${expandedIds.includes(noti.id) ? 'rotate-90' : ''}`} />
                    )}
                  </div>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); deleteNotification(noti.id); }}
                  className="absolute top-3 right-3 p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                  title={t('noti_delete')}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
