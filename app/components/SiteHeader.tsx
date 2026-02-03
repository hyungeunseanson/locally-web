'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Menu, Globe, User, LogOut, Briefcase, ArrowRightLeft, Check } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import LoginModal from '@/app/components/LoginModal';
import { useRouter, usePathname } from 'next/navigation';
import { useLanguage } from '@/app/context/LanguageContext';

export default function SiteHeader() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isHost, setIsHost] = useState(false);
  const [isPending, setIsPending] = useState(false);
  
  // ✅ 메뉴 상태 관리 (여기가 핵심)
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { lang, setLang, t } = useLanguage();
  const languages = [
    { label: '한국어', value: 'ko' }, { label: 'English', value: 'en' },
    { label: '中文', value: 'zh' }, { label: '日本語', value: 'ja' }
  ];

  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  // 외부 클릭 시 메뉴 닫기
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
      else { setIsHost(false); setIsPending(false); }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const checkHostStatus = async (userId: string) => {
    const { data: app } = await supabase.from('host_applications').select('status').eq('user_id', userId).eq('status', 'approved').maybeSingle();
    const { count } = await supabase.from('experiences').select('*', { count: 'exact', head: true }).eq('host_id', userId);

    if (app || (count && count > 0)) { setIsHost(true); setIsPending(false); }
    else { setIsHost(false); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleModeSwitch = async () => {
    if (pathname?.startsWith('/host')) { router.push('/'); return; }
    if (!user) { setIsLoginModalOpen(true); return; }
    if (isPending) { alert("승인 대기 중입니다."); return; }
    if (!isHost) { router.push('/host/register'); return; }
    router.push('/host/dashboard');
  };

  const getButtonLabel = () => {
    if (pathname?.startsWith('/host')) return t('guest_mode');
    if (!user || !isHost) return t('become_host');
    return t('host_mode');
  };

  return (
    <>
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
      
      <header className="sticky top-0 z-[100] bg-white border-b border-slate-100" ref={menuRef}>
        <div className="max-w-[1760px] mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex-1 flex items-center z-[101]">
            <h1 className="text-2xl font-black tracking-tighter cursor-pointer text-slate-900">Locally</h1>
          </Link>

          <div className="flex items-center justify-end gap-2 z-[101]">
            <button onClick={handleModeSwitch} className="flex items-center gap-2 text-sm font-semibold px-4 py-2 hover:bg-slate-50 rounded-full transition-colors text-slate-900 border border-transparent hover:border-slate-200 cursor-pointer">
               {pathname?.startsWith('/host') ? <ArrowRightLeft size={18} className="md:hidden"/> : <Briefcase size={18} className="md:hidden" />}
               <span className="hidden md:inline">{getButtonLabel()}</span>
            </button>

            {/* 언어 선택 */}
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

            {/* ✅ 유저 메뉴 (클릭 방식) */}
            <div className="relative">
              <div 
                onClick={() => user ? setIsMenuOpen(!isMenuOpen) : setIsLoginModalOpen(true)}
                className="flex items-center gap-2 border border-slate-300 rounded-full p-1 pl-2 hover:shadow-md transition-shadow cursor-pointer ml-1 bg-white"
              >
                <Menu size={18} className="ml-2"/>
                <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-200 flex items-center justify-center text-slate-500">
                  {user ? (
                    <img src={user.user_metadata.avatar_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User size={18} fill="currentColor" />
                  )}
                </div>
              </div>

              {/* 드롭다운 메뉴 */}
              {user && isMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-60 bg-white border border-slate-100 rounded-xl shadow-xl py-2 z-[200]">
                  <div className="px-4 py-3 border-b border-slate-100 mb-1">
                    <p className="font-bold text-sm truncate">{user.user_metadata.full_name || 'User'}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                  <button onClick={handleModeSwitch} className="w-full text-left md:hidden px-4 py-2 hover:bg-slate-50 text-sm font-semibold text-rose-600">{getButtonLabel()}</button>
                  <Link href="/guest/trips" className="block px-4 py-2 hover:bg-slate-50 text-sm font-semibold">{t('my_trips')}</Link>
                  <div className="border-t border-slate-100 my-1"></div>
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm text-red-500 font-semibold flex gap-2"><LogOut size={14}/> {t('logout')}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}