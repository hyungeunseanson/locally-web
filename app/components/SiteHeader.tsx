'use client';

import React, { useState, useEffect } from 'react';
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
  
  // 🌍 언어
  const [isLangOpen, setIsLangOpen] = useState(false);
  const { lang, setLang, t } = useLanguage();
  const languages = [
    { label: '한국어', value: 'ko' }, { label: 'English', value: 'en' },
    { label: '中文', value: 'zh' }, { label: '日本語', value: 'ja' }
  ];

  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  // 초기 상태 체크
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
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // 호스트 여부 확인
  const checkHostStatus = async (userId: string) => {
    // 1. 신청서 승인 확인
    const { data: app } = await supabase
      .from('host_applications')
      .select('status')
      .eq('user_id', userId)
      .eq('status', 'approved')
      .maybeSingle();
    
    // 2. 체험 등록 여부 확인
    const { count } = await supabase
      .from('experiences')
      .select('*', { count: 'exact', head: true })
      .eq('host_id', userId);

    if (app || (count && count > 0)) {
      setIsHost(true);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    alert(t('logout'));
    window.location.reload();
  };

  // ✅ 버튼 클릭 로직 (단순화: 일단 이동 시도)
  const handleModeSwitch = async () => {
    // 1. 이미 호스트 페이지면 -> 메인으로
    if (pathname?.startsWith('/host')) {
      router.push('/');
      return;
    }
    // 2. 로그인 안 했으면 -> 로그인 모달
    if (!user) {
      setIsLoginModalOpen(true);
      return;
    }

    // 3. 호스트인지 다시 한 번 체크 (클릭 순간 최신 상태 반영)
    let currentIsHost = isHost;
    if (!currentIsHost) {
        // DB 한번 더 찔러보기
        const { data: app } = await supabase
          .from('host_applications')
          .select('status')
          .eq('user_id', user.id)
          .eq('status', 'approved')
          .maybeSingle();
        if (app) currentIsHost = true;
    }

    // 4. 호스트가 아니면 -> 등록 페이지
    if (!currentIsHost) {
      router.push('/host/register');
      return;
    }

    // 5. 호스트면 -> 대시보드
    router.push('/host/dashboard');
  };

  const getButtonLabel = () => {
    if (pathname?.startsWith('/host')) return t('guest_mode');
    if (!user) return t('become_host');
    if (!isHost) return t('become_host');
    return t('host_mode');
  };

  return (
    <>
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
      
      <header className="sticky top-0 z-[100] bg-white border-b border-slate-100">
        <div className="max-w-[1760px] mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex-1 flex items-center z-[101]">
            <h1 className="text-2xl font-black tracking-tighter cursor-pointer text-slate-900">Locally</h1>
          </Link>

          <div className="flex items-center justify-end gap-2 z-[101]">
            
            {/* ✅ 버튼: disabled 속성 제거하여 무조건 눌리게 함 */}
            <button 
              onClick={handleModeSwitch}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2 hover:bg-slate-50 rounded-full transition-colors text-slate-900 border border-transparent hover:border-slate-200 cursor-pointer"
            >
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

            {/* 유저 메뉴 */}
            {user ? (
              <div className="relative group">
                <div className="flex items-center gap-2 border border-slate-300 rounded-full p-1 pl-2 hover:shadow-md transition-shadow cursor-pointer ml-1 bg-white">
                  <Menu size={18} className="ml-2"/>
                  <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-200">
                    <img src={user.user_metadata.avatar_url || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e"} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                </div>
                <div className="absolute top-full right-0 mt-2 w-60 bg-white border border-slate-100 rounded-xl shadow-xl py-2 invisible group-hover:visible opacity-0 z-[200]">
                  <div className="px-4 py-3 border-b border-slate-100 mb-1">
                    <p className="font-bold text-sm truncate">{user.user_metadata.full_name || 'User'}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                  {/* 모바일용 메뉴 추가 */}
                  <button onClick={handleModeSwitch} className="w-full text-left md:hidden px-4 py-2 hover:bg-slate-50 text-sm font-semibold text-rose-600">
                    {getButtonLabel()}
                  </button>
                  <Link href="/guest/trips" className="block px-4 py-2 hover:bg-slate-50 text-sm font-semibold">{t('my_trips')}</Link>
                  <div className="border-t border-slate-100 my-1"></div>
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm text-red-500 font-semibold flex gap-2"><LogOut size={14}/> {t('logout')}</button>
                </div>
              </div>
            ) : (
              <div onClick={() => setIsLoginModalOpen(true)} className="flex items-center gap-2 border border-slate-300 rounded-full p-1 pl-3 hover:shadow-md transition-shadow cursor-pointer ml-1 bg-white relative z-[101]">
                <Menu size={18} />
                <div className="bg-slate-500 rounded-full p-1 text-white"><User size={18} fill="currentColor" /></div>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}