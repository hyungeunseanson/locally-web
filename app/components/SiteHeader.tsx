'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, Globe, User, LogOut } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client'; // 아래에서 만들 파일
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
        // 에러 무시
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
      
      <header className="sticky top-0 z-50 bg-white border-b border-slate-100">
        <div className="max-w-[1760px] mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex-1 flex items-center">
            <h1 className="text-2xl font-black tracking-tighter cursor-pointer text-slate-900">Locally</h1>
          </Link>

          <div className="flex-1 flex items-center justify-end gap-2">
            <Link href="/host/dashboard">
              <button className="text-sm font-semibold px-4 py-2 hover:bg-slate-50 rounded-full transition-colors hidden md:block text-slate-900">
                호스트 모드로 전환
              </button>
            </Link>
            <button className="p-2 hover:bg-slate-50 rounded-full"><Globe size={18} /></button>

            {user ? (
              <div className="flex items-center gap-2 border border-slate-300 rounded-full p-1 pl-2 hover:shadow-md transition-shadow cursor-pointer ml-1 relative group">
                <Menu size={18} className="ml-2"/>
                <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-200">
                  <img src={user.user_metadata.avatar_url || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e"} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="absolute top-12 right-0 w-60 bg-white border border-slate-100 rounded-xl shadow-xl py-2 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all">
                  <div className="px-4 py-3 border-b border-slate-100 mb-1">
                    <p className="font-bold text-sm truncate">{user.user_metadata.full_name || '게스트'}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                  <Link href="/guest/trips" className="block px-4 py-2 hover:bg-slate-50 text-sm font-semibold">나의 여행</Link>
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm text-red-500 font-semibold flex items-center gap-2"><LogOut size={14}/> 로그아웃</button>
                </div>
              </div>
            ) : (
              <div onClick={() => setIsLoginModalOpen(true)} className="flex items-center gap-2 border border-slate-300 rounded-full p-1 pl-3 hover:shadow-md transition-shadow cursor-pointer ml-1">
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