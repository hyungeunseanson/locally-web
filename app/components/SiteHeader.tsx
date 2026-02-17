'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { Menu, Globe, User, LogOut, Briefcase, Heart, MessageSquare, Settings, HelpCircle, Check, Bell } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import { useLanguage } from '@/app/context/LanguageContext';
import { useNotification } from '@/app/context/NotificationContext';
import dynamic from 'next/dynamic';
import LanguageSelector from './LanguageSelector'; // 🟢 [추가] 새로 만든 파일 불러오기


// 🟢 LoginModal 동적 로딩 (SSR false)
const LoginModal = dynamic(() => import('./LoginModal'), { 
  ssr: false, 
  loading: () => null 
});

// 🟢 [핵심] 실제 헤더의 모든 로직은 여기에 다 넣습니다. (이름이 Content임에 주의!)
function SiteHeaderContent() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isHost, setIsHost] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  
  const { unreadCount } = useNotification();
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const menuRef = useRef<HTMLElement>(null);
  const { t } = useLanguage();
  const languageContext = useLanguage();



  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function handleClickOutside(event: any) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
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
    if (pathname?.startsWith('/host')) return t('guest_mode');
    return t('become_host');
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
            <LanguageSelector />

            {user && (
              <Link 
                href="/notifications" 
                className="relative mx-1 p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors inline-block"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full animate-bounce"></span>
                )}
              </Link>
            )}

            <div className="relative ml-1">
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

              {user && isMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-100 rounded-xl shadow-xl py-2 z-[200] overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <div className="py-2 border-b border-slate-100">
                    <Link href="/guest/inbox" className="px-4 py-3 hover:bg-slate-50 flex items-center justify-between text-sm font-semibold text-slate-700">
                       <span className="flex items-center gap-3"><MessageSquare size={18}/> {t('messages')}</span>
                    </Link>
                    <Link href="/guest/trips" className="px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm font-semibold text-slate-700">
                       <Briefcase size={18}/> {t('my_trips')}
                    </Link>
                    <Link href="/guest/wishlists" className="px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm font-semibold text-slate-700">
                       <Heart size={18}/> {t('wishlist')}
                    </Link>
                  </div>

                  <div className="py-2 border-b border-slate-100">
                    <Link href="/account" className="px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm text-slate-700">
                       <User size={18}/> {t('account')}
                    </Link>
                    <button onClick={handleDropdownMenuClick} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm text-slate-700">
                       <Settings size={18}/> {pathname?.startsWith('/host') ? t('guest_mode') : t('host_mode')}
                    </button>
                  </div>

                  <div className="py-2">
                    <Link href="/help" className="px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm text-slate-700">
                       <HelpCircle size={18}/> {t('help')}
                    </Link>
                    <button onClick={handleLogout} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm text-slate-700">
                      <LogOut size={18}/> {t('logout')}
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

// 🟢 [최종 방어] 진짜 SiteHeader는 이것입니다.
// 이 코드가 있어야 빌드 에러가 안 납니다. 
export default function SiteHeader() {
  return (
    <Suspense fallback={<div className="h-20 bg-white border-b border-slate-100" />}>
      <SiteHeaderContent />
    </Suspense>
  );
}