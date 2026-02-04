'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Menu, Globe, User, LogOut, Briefcase, Heart, MessageCircle, Settings, HelpCircle } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import LoginModal from '@/app/components/LoginModal';
import { useRouter, usePathname } from 'next/navigation';
import { useLanguage } from '@/app/context/LanguageContext';

export default function SiteHeader() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isHost, setIsHost] = useState(false);
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const languageContext = useLanguage();
  const setLang = languageContext?.setLang || (() => {});
  const lang = languageContext?.lang || 'ko';
  const t = languageContext?.t || ((k: string) => k);

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
      else setIsHost(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkHostStatus = async (userId: string) => {
    const { data: app } = await supabase.from('host_applications').select('status').eq('user_id', userId).eq('status', 'approved').maybeSingle();
    const { count } = await supabase.from('experiences').select('*', { count: 'exact', head: true }).eq('host_id', userId);
    if (app || (count && count > 0)) setIsHost(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleModeSwitch = async () => {
    if (pathname?.startsWith('/host')) { router.push('/'); return; }
    if (!user) { setIsLoginModalOpen(true); return; }
    if (!isHost) { router.push('/host/register'); return; }
    router.push('/host/dashboard');
  };

  const getButtonLabel = () => {
    if (pathname?.startsWith('/host')) return t('guest_mode');
    if (!user || !isHost) return t('become_host');
    return t('host_mode');
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
              onClick={handleModeSwitch} 
              className="hidden md:block text-sm font-semibold px-4 py-2 hover:bg-slate-50 rounded-full transition-colors text-slate-900 cursor-pointer"
            >
               {getButtonLabel()}
            </button>

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

              {/* ✨ 개편된 드롭다운 메뉴 */}
              {user && isMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-100 rounded-xl shadow-xl py-2 z-[200] overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  
                  {/* 주요 활동 */}
                  <div className="py-2 border-b border-slate-100">
                    <Link href="/guest/inbox" className="px-4 py-3 hover:bg-slate-50 flex items-center justify-between text-sm font-semibold text-slate-700">
                       <span className="flex items-center gap-3"><MessageCircle size={18}/> 메시지</span>
                       {/* 알림 뱃지 예시 (나중에 로직 연결) */}
                       <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">N</span> 
                    </Link>
                    <Link href="/guest/trips" className="px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm font-semibold text-slate-700">
                       <Briefcase size={18}/> 여행
                    </Link>
                    <Link href="/guest/wishlists" className="px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm font-semibold text-slate-700">
   <Heart size={18}/> 위시리스트
</Link>
                  </div>

                  {/* 계정 설정 */}
                  <div className="py-2 border-b border-slate-100">
                    <Link href="/account" className="px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm text-slate-700">
                       <User size={18}/> 프로필 및 계정
                    </Link>
                    <button onClick={handleModeSwitch} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm text-slate-700">
                       <Settings size={18}/> {pathname?.startsWith('/host') ? t('guest_mode') : t('host_mode')}
                    </button>
                  </div>

                  {/* 도움말 & 로그아웃 */}
                  <div className="py-2">
                    <Link href="/help" className="px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm text-slate-700">
                       <HelpCircle size={18}/> 도움말 센터
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