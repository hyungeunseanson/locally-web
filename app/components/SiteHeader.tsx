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

import { useAuth } from '@/app/context/AuthContext'; // 🟢 Auth 훅 사용

// ...

function SiteHeaderContent() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 🟢 [핵심] 로컬 상태 대신 전역 AuthContext 사용 (깜빡임 해결)
  const { user, isHost, applicationStatus, isLoading, signOut } = useAuth();

  const { unreadCount } = useNotification();
  const menuRef = useRef<HTMLElement>(null);
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();

  // 🟢 [수정] 로그아웃은 AuthContext의 signOut 호출
  const handleLogout = async () => {
    await signOut();
  };

  useEffect(() => {
    function handleClickOutside(event: any) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  // 🟢 로딩 중이거나 유저가 없으면 기본값 처리 (깜빡임 방지용 스피너는 헤더에서 안 보여주는 게 나음)
  const getAvatarUrl = () => user?.user_metadata?.avatar_url || null;

  return (
    <>
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />

      <header className="hidden md:block sticky top-0 z-[100] bg-white border-b border-slate-100" ref={menuRef}>
        <div className="max-w-[1760px] mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex-1 flex items-center gap-[2px] z-[101] group h-full">
            <img
              src="/images/logo.png"
              alt="Locally Logo"
              className="w-[52px] h-[52px] object-contain mix-blend-multiply grayscale contrast-200 group-hover:scale-105 transition-transform duration-300"
            />
            <h1 className="text-[18px] font-bold tracking-tight cursor-pointer text-[#111827] leading-none mb-[1.5px]">Locally</h1>
          </Link>

          <div className="flex items-center justify-end gap-2 z-[101]">
            <button
              onClick={handleMainHeaderButtonClick}
              className="hidden md:block text-sm font-semibold px-4 py-2 hover:bg-slate-50 rounded-full transition-colors text-slate-900 cursor-pointer"
            >
              {getButtonLabel()}
            </button>
            <LanguageSelector />

            {/* 🟢 로딩이 끝난 후에만 알림/유저 아이콘 표시 (깜빡임 최소화) */}
            {!isLoading && user ? (
              <Link
                href="/notifications"
                className="relative mx-1 p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors inline-block"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full animate-bounce"></span>
                )}
              </Link>
            ) : null}

            <div className="relative ml-1">
              <div
                onClick={() => (!isLoading && user) ? setIsMenuOpen(!isMenuOpen) : setIsLoginModalOpen(true)}
                className="flex items-center gap-2 border border-slate-300 rounded-full p-1 pl-2 hover:shadow-md transition-shadow cursor-pointer ml-1 bg-white select-none"
              >
                <Menu size={18} className="ml-2" />
                <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-200 flex items-center justify-center text-slate-500">
                  {/* 🟢 로딩 중일 땐 기본 아이콘 유지 */}
                  {!isLoading && user && getAvatarUrl() ? (
                    <img src={getAvatarUrl()} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="profile" />
                  ) : (
                    <User size={18} fill="currentColor" />
                  )}
                </div>
              </div>

              {!isLoading && user && isMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-100 rounded-xl shadow-xl py-2 z-[200] overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <div className="py-2 border-b border-slate-100">
                    <Link href="/guest/inbox" className="px-4 py-3 hover:bg-slate-50 flex items-center justify-between text-sm font-semibold text-slate-700">
                      <span className="flex items-center gap-3"><MessageSquare size={18} /> {t('messages')}</span>
                    </Link>
                    <Link href="/guest/trips" className="px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm font-semibold text-slate-700">
                      <Briefcase size={18} /> {t('my_trips')}
                    </Link>
                    <Link href="/guest/wishlists" className="px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm font-semibold text-slate-700">
                      <Heart size={18} /> {t('wishlist')}
                    </Link>
                  </div>

                  <div className="py-2 border-b border-slate-100">
                    <Link href="/account" className="px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm text-slate-700">
                      <User size={18} /> {t('account')}
                    </Link>
                    <button onClick={handleDropdownMenuClick} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm text-slate-700">
                      <Settings size={18} /> {pathname?.startsWith('/host') ? t('guest_mode') : t('host_mode')}
                    </button>
                  </div>

                  <div className="py-2">
                    <Link href="/help" className="px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm text-slate-700">
                      <HelpCircle size={18} /> {t('help')}
                    </Link>
                    <button onClick={handleLogout} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm text-slate-700">
                      <LogOut size={18} /> {t('logout')}
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