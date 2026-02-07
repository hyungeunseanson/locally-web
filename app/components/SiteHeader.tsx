'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Menu, Globe, User, LogOut, Briefcase, Heart, MessageCircle, Settings, HelpCircle, Check, Bell } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import LoginModal from '@/app/components/LoginModal';
import { useRouter, usePathname } from 'next/navigation';
import { useLanguage } from '@/app/context/LanguageContext';
import { useNotification } from '../context/NotificationContext'; // ✅ 상대 경로로 수정됨

export default function SiteHeader() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isHost, setIsHost] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  
  // ✅ 알림 관련 훅
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();
  const [showNoti, setShowNoti] = useState(false);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const menuRef = useRef<HTMLHeaderElement>(null);

  const languageContext = useLanguage();
  const setLang = languageContext?.setLang || (() => {});
  const lang = languageContext?.lang || 'ko';

  const languages = [
    { label: '한국어', value: 'ko' }, { label: 'English', value: 'en' },
    { label: '中文', value: 'zh' }, { label: '日本語', value: 'ja' }
  ];

  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function handleClickOutside(event: any) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
        setIsLangOpen(false);
        setShowNoti(false); // ✅ 외부 클릭 시 알림창 닫기
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      if (session?.user) checkHostStatus(session.user.id);
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) checkHostStatus(session.user.id);
      else {
        setIsHost(false);
        setApplicationStatus(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const checkHostStatus = async (userId: string) => {
    const { data: app } = await supabase
      .from('host_applications')
      .select('status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (app) setApplicationStatus(app.status);

    const { count } = await supabase.from('experiences').select('*', { count: 'exact', head: true }).eq('host_id', userId);
    
    if ((app && (app.status === 'approved' || app.status === 'active')) || (count && count > 0)) {
      setIsHost(true);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleMainHeaderButtonClick = () => {
    if (pathname?.startsWith('/host')) { 
      router.push('/'); 
    } else {
      router.push('/become-a-host');
    }
  };

  const handleDropdownMenuClick = () => {
    if (pathname?.startsWith('/host')) { 
      router.push('/'); 
      return;
    }

    if (applicationStatus || isHost) {
      router.push('/host/dashboard'); 
    } else {
      router.push('/become-a-host'); 
    }
  };

  const getButtonLabel = () => {
    if (pathname?.startsWith('/host')) return '게스트 모드';
    return '호스트 등록하기';
  };

  const getAvatarUrl = () => user?.user_metadata?.avatar_url || null;

  return (
    <>
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
      
      <header className="sticky top-0 z-[100] bg-white border-b border-slate-100" ref={menuRef}>
        <div className="max-w-[1760px] mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex-1 flex items-center z-[101]">
            <h1 className="text-2xl font-black tracking-tighter cursor-pointer text-slate-900">Locally</h1>
          </Link>

          <div className="flex items-center justify-end gap-2 z-[101]">
            <button 
              onClick={handleMainHeaderButtonClick} 
              className="hidden md:block text-sm font-semibold px-4 py-2 hover:bg-slate-50 rounded-full transition-colors text-slate-900 cursor-pointer"
            >
               {getButtonLabel()}
            </button>

            {/* 언어 설정 */}
            <div className="relative hidden sm:block">
              <button onClick={() => setIsLangOpen(!isLangOpen)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                <Globe size={18} />
              </button>
              {isLangOpen && (
                <div className="absolute top-12 right-0 w-40 bg-white border border-slate-100 rounded-xl shadow-xl py-2 z-[200]">
                  {languages.map((l) => (
                    <button key={l.value} onClick={() => { setLang(l.value); setIsLangOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex justify-between">
                      {l.label} {lang === l.value && <Check size={14}/>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ✅ [위치 확정] 알림 아이콘 (로그인 상태일 때만) */}
            {user && (
              <div className="relative">
                <button 
                  onClick={() => setShowNoti(!showNoti)} 
                  className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white animate-pulse"></span>
                  )}
                </button>

                {/* 알림 드롭다운 */}
                {showNoti && (
                  <div className="absolute right-0 top-12 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-[200] overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <span className="font-bold text-sm text-slate-800">알림</span>
                      <button onClick={markAllAsRead} className="text-xs text-slate-500 hover:text-black font-medium">모두 읽음</button>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-400">새로운 알림이 없습니다.</div>
                      ) : (
                        notifications.map(n => (
                          <div 
                            key={n.id} 
                            onClick={() => { markAsRead(n.id); if(n.link) window.location.href = n.link; }}
                            className={`p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${!n.is_read ? 'bg-blue-50/30' : ''}`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-bold text-xs text-slate-800 line-clamp-1">{n.title}</span>
                              <span className="text-[10px] text-slate-400 shrink-0 ml-2">{new Date(n.created_at).toLocaleDateString()}</span>
                            </div>
                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 프로필 메뉴 */}
            <div className="relative">
              <div 
                onClick={() => user ? setIsMenuOpen(!isMenuOpen) : setIsLoginModalOpen(true)}
                className="flex items-center gap-2 border border-slate-300 rounded-full p-1 pl-2 hover:shadow-md transition-shadow cursor-pointer ml-1 bg-white select-none"
              >
                <Menu size={18} className="ml-2"/>
                <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-200 flex items-center justify-center text-slate-500">
                  {user && getAvatarUrl() ? (
                    <img src={getAvatarUrl()} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="profile" />
                  ) : (
                    <User size={18} fill="currentColor" />
                  )}
                </div>
              </div>

              {/* 드롭다운 메뉴 */}
              {user && isMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-100 rounded-xl shadow-xl py-2 z-[200] overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <div className="py-2 border-b border-slate-100">
                    <Link href="/guest/inbox" className="px-4 py-3 hover:bg-slate-50 flex items-center justify-between text-sm font-semibold text-slate-700">
                       <span className="flex items-center gap-3"><MessageCircle size={18}/> 메시지</span>
                    </Link>
                    <Link href="/guest/trips" className="px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm font-semibold text-slate-700">
                       <Briefcase size={18}/> 여행
                    </Link>
                    <Link href="/guest/wishlists" className="px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm font-semibold text-slate-700">
                       <Heart size={18}/> 위시리스트
                    </Link>
                  </div>

                  <div className="py-2 border-b border-slate-100">
                    <Link href="/account" className="px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm text-slate-700">
                       <User size={18}/> 프로필 및 계정
                    </Link>
                    <button onClick={handleDropdownMenuClick} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm text-slate-700">
                       <Settings size={18}/> {pathname?.startsWith('/host') ? '게스트 모드' : '호스트 모드'}
                    </button>
                  </div>

                  <div className="py-2">
                    <Link href="/help" className="px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm text-slate-700">
                       <HelpCircle size={18}/> 도움말 센터
                    </Link>
                    <button onClick={handleLogout} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm text-slate-700">
                      <LogOut size={18}/> 로그아웃
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}