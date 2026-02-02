'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, Globe, User, LogOut, Briefcase } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import LoginModal from '@/app/components/LoginModal';

export default function SiteHeader() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user || null);
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user || null);
        });
        return () => subscription.unsubscribe();
      } catch (error) {
        console.error("Auth Error", error);
      }
    };
    initSession();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    alert('로그아웃 되었습니다.');
    window.location.reload();
  };

  return (
    <>
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
      
      {/* z-index를 50 -> 100으로 높여서 다른 요소 위에 확실히 뜨게 함 */}
      <header className="sticky top-0 z-[100] bg-white border-b border-slate-100">
        <div className="max-w-[1760px] mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex-1 flex items-center">
            <h1 className="text-2xl font-black tracking-tighter cursor-pointer text-slate-900">Locally</h1>
          </Link>

          <div className="flex items-center justify-end gap-2">
            {/* 호스트 모드 버튼 (모바일에서도 보이게) */}
            <Link href="/host/dashboard" className="flex items-center">
              <button className="flex items-center gap-2 text-sm font-semibold px-3 py-2 hover:bg-slate-50 rounded-full transition-colors text-slate-900 border border-transparent hover:border-slate-200">
                 <Briefcase size={18} className="md:hidden" />
                 <span className="hidden md:inline">호스트 모드로 전환</span>
              </button>
            </Link>

            <button className="p-2 hover:bg-slate-50 rounded-full hidden sm:block">
              <Globe size={18} />
            </button>

            {user ? (
              <div className="relative group">
                <div className="flex items-center gap-2 border border-slate-300 rounded-full p-1 pl-2 hover:shadow-md transition-shadow cursor-pointer ml-1 bg-white">
                  <Menu size={18} className="ml-2"/>
                  <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-200">
                    <img src={user.user_metadata.avatar_url || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e"} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                </div>
                
                {/* 드롭다운 메뉴 (위치 조정 및 z-index 강화) */}
                <div className="absolute top-full right-0 mt-2 w-60 bg-white border border-slate-100 rounded-xl shadow-xl py-2 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all z-[101]">
                  <div className="px-4 py-3 border-b border-slate-100 mb-1">
                    <p className="font-bold text-sm truncate">{user.user_metadata.full_name || '게스트'}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                  <Link href="/host/dashboard" className="block md:hidden px-4 py-2 hover:bg-slate-50 text-sm font-semibold text-rose-600">호스트 대시보드</Link>
                  <Link href="/guest/trips" className="block px-4 py-2 hover:bg-slate-50 text-sm font-semibold">나의 여행</Link>
                  <div className="border-t border-slate-100 my-1"></div>
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm text-red-500 font-semibold flex items-center gap-2"><LogOut size={14}/> 로그아웃</button>
                </div>
              </div>
            ) : (
              <div onClick={() => setIsLoginModalOpen(true)} className="flex items-center gap-2 border border-slate-300 rounded-full p-1 pl-3 hover:shadow-md transition-shadow cursor-pointer ml-1 z-[100] relative bg-white">
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