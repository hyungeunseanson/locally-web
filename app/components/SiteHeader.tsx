'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, Globe, User, LogOut, Briefcase } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import LoginModal from '@/app/components/LoginModal';
import { useRouter } from 'next/navigation';

export default function SiteHeader() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (_event === 'SIGNED_IN' || _event === 'SIGNED_OUT') {
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    alert('로그아웃 되었습니다.');
    window.location.reload();
  };

  return (
    <>
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
      
      {/* z-index 100으로 최상위 보장 */}
      <header className="sticky top-0 z-[100] bg-white border-b border-slate-100">
        <div className="max-w-[1760px] mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex-1 flex items-center z-[101]">
            <h1 className="text-2xl font-black tracking-tighter cursor-pointer text-slate-900">Locally</h1>
          </Link>

          <div className="flex items-center justify-end gap-2 z-[101]">
            {/* ✅ [수정됨] button 태그 삭제! Link가 직접 버튼 역할을 합니다. */}
            <Link 
              href="/host/dashboard" 
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2 hover:bg-slate-50 rounded-full transition-colors text-slate-900 border border-transparent hover:border-slate-200 cursor-pointer"
            >
               <Briefcase size={18} className="md:hidden" />
               <span className="hidden md:inline">호스트 모드로 전환</span>
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
                
                <div className="absolute top-full right-0 mt-2 w-60 bg-white border border-slate-100 rounded-xl shadow-xl py-2 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all z-[200]">
                  <div className="px-4 py-3 border-b border-slate-100 mb-1">
                    <p className="font-bold text-sm truncate">{user.user_metadata.full_name || '게스트'}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                  {/* 모바일 메뉴에서도 호스트 대시보드 링크 추가 */}
                  <Link href="/host/dashboard" className="block md:hidden px-4 py-2 hover:bg-slate-50 text-sm font-semibold text-rose-600">호스트 대시보드</Link>
                  <Link href="/guest/trips" className="block px-4 py-2 hover:bg-slate-50 text-sm font-semibold">나의 여행</Link>
                  <div className="border-t border-slate-100 my-1"></div>
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm text-red-500 font-semibold flex items-center gap-2"><LogOut size={14}/> 로그아웃</button>
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