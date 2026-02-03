'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Menu, Globe, User, LogOut, MessageSquare, Heart, Settings, HelpCircle } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import LoginModal from '@/app/components/LoginModal';
import { useRouter, usePathname } from 'next/navigation';
import { useLanguage } from '@/app/context/LanguageContext';

export default function SiteHeader() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isHost, setIsHost] = useState(false);
  
  // 메뉴 상태
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { setLang, t } = useLanguage();
  const languages = [
    { label: '한국어', value: 'ko' }, { label: 'English', value: 'en' },
    { label: '中文', value: 'zh' }, { label: '日本語', value: 'ja' }
  ];

  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  // 외부 클릭 닫기
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
  }, [supabase]);

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

  return (
    <>
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
      
      <header className="sticky top-0 z-[100] bg-white border-b border-slate-100" ref={menuRef}>
        <div className="max-w-[1760px] mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex-1 flex items-center z-[101]">
            <h1 className="text-2xl font-black tracking-tighter cursor-pointer text-slate-900">Locally</h1>
          </Link>

          <div className="flex items-center justify-end gap-2 z-[101]">
            {/* 호스트 모드 버튼 (PC) */}
            <button 
              onClick={handleModeSwitch} 
              className="hidden md:block text-sm font-semibold px-4 py-2 hover:bg-slate-50 rounded-full transition-colors text-slate-900 cursor-pointer"
            >
               {pathname?.startsWith('/host') ? '게스트 모드로 전환' : (user && isHost ? '호스트 모드로 전환' : '호스트 되기')}
            </button>

            {/* 언어 버튼 */}
            <div className="relative hidden sm:block">
              <button onClick={() => setIsLangOpen(!isLangOpen)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                <Globe size={18} />
              </button>
              {isLangOpen && (
                <div className="absolute top-12 right-0 w-40 bg-white border border-slate-100 rounded-xl shadow-xl py-2 z-[200]">
                  {languages.map((l) => (
                    <button key={l.value} onClick={() => { setLang(l.value); setIsLangOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50">
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 유저 메뉴 버튼 */}
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

              {/* 드롭다운 메뉴 (에어비앤비 스타일) */}
              {user && isMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-100 rounded-xl shadow-xl py-2 z-[200] overflow-hidden">
                  
                  {/* 상단 그룹: 메시지, 여행, 위시리스트 */}
                  <div className="py-2 border-b border-slate-100">
                    <Link href="/guest/inbox" className="px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm font-semibold text-slate-700">
                       <MessageSquare size={18}/> 메시지
                       <span className="ml-auto bg-rose-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">1</span>
                    </Link>
                    <Link href="/guest/trips" className="px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm font-semibold text-slate-700">
                       <Briefcase size={18}/> 여행
                    </Link>
                    <button className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 text-sm font-semibold text-slate-700">
                       <Heart size={18}/> 위시리스트
                    </button>
                  </div>

                  {/* 중간 그룹: 호스팅, 계정, 도움말 */}
                  <div className="py-2 border-b border-slate-100">
                    <button onClick={handleModeSwitch} className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm text-slate-700">
                      {pathname?.startsWith('/host') ? '게스트 모드로 전환' : '호스트 모드로 전환'}
                    </button>
                    <Link href="/account" className="block px-4 py-3 hover:bg-slate-50 text-sm text-slate-700">계정 관리</Link>
                    <Link href="/help" className="block px-4 py-3 hover:bg-slate-50 text-sm text-slate-700">도움말 센터</Link>
                  </div>

                  {/* 하단: 로그아웃 */}
                  <div className="py-2">
                    <button onClick={handleLogout} className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm text-slate-700">로그아웃</button>
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