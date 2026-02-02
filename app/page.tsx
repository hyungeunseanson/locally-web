'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, Menu, Globe, User, Heart, Star, 
  MapPin, SlidersHorizontal, LogOut 
} from 'lucide-react';
import Link from 'next/link';
import LoginModal from './components/LoginModal';
import { supabase } from './lib/supabase';

// 카테고리 (디자인 유지)
const CATEGORIES = [
  { id: 'all', label: '전체', icon: '🌍' },
  { id: 'culture', label: '문화/예술', icon: '🎨' },
  { id: 'food', label: '음식/투어', icon: '🍳' },
  { id: 'nature', label: '자연/야외', icon: '🌲' },
  { id: 'night', label: '나이트라이프', icon: '🍸' },
  { id: 'class', label: '원데이클래스', icon: '🧶' },
];

export default function HomePage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  // ✅ 변경점: 가짜 데이터 삭제하고, state로 관리
  const [experiences, setExperiences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. 유저 세션 체크
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    // 2. ✅ 실제 DB 데이터 가져오기 (여기가 핵심!)
    const fetchExperiences = async () => {
      try {
        let query = supabase
          .from('experiences')
          .select('*')
          .order('created_at', { ascending: false });
        
        // 카테고리 필터 (선택 시 작동)
        if (selectedCategory !== 'all') {
          query = query.eq('category', selectedCategory);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (data) setExperiences(data);
      } catch (error) {
        console.error('데이터 로딩 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchExperiences();

    return () => subscription.unsubscribe();
  }, [selectedCategory]); // 카테고리 바뀔 때마다 다시 불러옴

  const handleLogout = async () => {
    await supabase.auth.signOut();
    alert('로그아웃 되었습니다.');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={() => setIsLoginModalOpen(false)}
      />

      {/* Header (디자인 유지) */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-100">
        <div className="max-w-[1760px] mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex-1 flex items-center">
            <h1 className="text-2xl font-black tracking-tighter cursor-pointer text-slate-900">Locally</h1>
          </Link>

          <div className="flex-1 max-w-2xl hidden md:flex items-center justify-between bg-white border border-slate-300 rounded-full shadow-sm hover:shadow-md transition-shadow py-2.5 pl-6 pr-2 cursor-pointer">
            <div className="flex divide-x divide-slate-300 w-full text-sm">
              <button className="px-4 font-semibold text-slate-900 truncate">어디로 떠나세요?</button>
              <button className="px-4 font-semibold text-slate-900 truncate">날짜</button>
              <button className="px-4 text-slate-500 truncate">게스트 추가</button>
            </div>
            <div className="bg-black p-2.5 rounded-full text-white">
              <Search size={16} strokeWidth={3} />
            </div>
          </div>

          <div className="flex-1 flex items-center justify-end gap-2">
            <Link href="/host/dashboard">
              <button className="text-sm font-semibold px-4 py-2 hover:bg-slate-50 rounded-full transition-colors hidden md:block text-slate-900">
                호스트 모드로 전환
              </button>
            </Link>
            <button className="p-2 hover:bg-slate-50 rounded-full">
              <Globe size={18} />
            </button>

            {user ? (
              <div className="flex items-center gap-2 border border-slate-300 rounded-full p-1 pl-2 hover:shadow-md transition-shadow cursor-pointer ml-1 relative group">
                <Menu size={18} className="ml-2"/>
                <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-200">
                  <img 
                    src={user.user_metadata.avatar_url || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e"} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    alt="profile"
                  />
                </div>
                <div className="absolute top-12 right-0 w-60 bg-white border border-slate-100 rounded-xl shadow-xl py-2 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all">
                  <div className="px-4 py-3 border-b border-slate-100 mb-1">
                    <p className="font-bold text-sm truncate">{user.user_metadata.full_name || '게스트'}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                  <Link href="/guest/trips" className="block px-4 py-2 hover:bg-slate-50 text-sm font-semibold">나의 여행</Link>
                  <Link href="/guest/inbox" className="block px-4 py-2 hover:bg-slate-50 text-sm font-semibold">메시지함</Link>
                  <div className="border-t border-slate-100 my-1"></div>
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm text-red-500 font-semibold flex items-center gap-2">
                    <LogOut size={14}/> 로그아웃
                  </button>
                </div>
              </div>
            ) : (
              <div 
                onClick={() => setIsLoginModalOpen(true)}
                className="flex items-center gap-2 border border-slate-300 rounded-full p-1 pl-3 hover:shadow-md transition-shadow cursor-pointer ml-1"
              >
                <Menu size={18} />
                <div className="bg-slate-500 rounded-full p-1 text-white">
                  <User size={18} fill="currentColor" />
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Category Filter (디자인 유지) */}
      <div className="bg-white pt-6 pb-4 sticky top-20 z-40 shadow-sm md:shadow-none">
        <div className="max-w-[1760px] mx-auto px-6 flex items-center gap-8 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button 
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex flex-col items-center gap-2 min-w-[64px] pb-2 transition-all border-b-2 ${
                selectedCategory === cat.id 
                  ? 'border-black text-black opacity-100' 
                  : 'border-transparent text-slate-500 opacity-60 hover:opacity-100 hover:border-slate-200'
              }`}
            >
              <span className="text-2xl">{cat.icon}</span>
              <span className="text-xs font-semibold whitespace-nowrap">{cat.label}</span>
            </button>
          ))}
          <button className="ml-auto flex items-center gap-2 border border-slate-300 rounded-xl px-4 py-2 text-xs font-semibold hover:border-black transition-colors hidden md:flex">
            <SlidersHorizontal size={14} /> 필터
          </button>
        </div>
      </div>

      {/* Main Content (실제 데이터 렌더링) */}
      <main className="max-w-[1760px] mx-auto px-6 py-8">
        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black"></div></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10">
          {experiences.length === 0 ? (
             <div className="col-span-full text-center py-20 text-slate-500">등록된 체험이 없습니다.</div>
          ) : (
             experiences.map((item) => (
              <Link href={`/experiences/${item.id}`} key={item.id}>
                <div className="group cursor-pointer">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-slate-200 mb-3 border border-slate-100">
                    <img 
                      src={item.image_url || "https://images.unsplash.com/photo-1542051841857-5f90071e7989"} 
                      alt={item.title} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <button className="absolute top-3 right-3 text-white/70 hover:text-white hover:scale-110 transition-all">
                      <Heart size={24} fill="rgba(0,0,0,0.5)" strokeWidth={2} />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-medium text-slate-900">{item.location || '위치 정보 없음'}</span>
                      <div className="flex items-center gap-1">
                        <Star size={12} fill="black" stroke="none" />
                        <span className="text-black">4.8</span>
                        <span className="text-slate-400">(120)</span>
                      </div>
                    </div>
                    <h3 className="text-sm font-light leading-snug line-clamp-2 text-slate-900 group-hover:underline decoration-1 underline-offset-2">
                      {item.title}
                    </h3>
                    <div className="pt-1">
                      <span className="font-bold text-sm">₩{Number(item.price).toLocaleString()}</span>
                      <span className="text-slate-500 text-sm font-light"> / 인</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
          </div>
        )}
      </main>

      {/* Footer (디자인 유지) */}
      <footer className="border-t border-slate-100 bg-slate-50 mt-20 py-10 px-6">
        <div className="max-w-[1760px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500">
          <div className="flex gap-4">
            <span>© 2026 Locally, Inc.</span>
            <Link href="/admin/dashboard" className="hover:text-black font-bold">관리자 페이지 (Admin)</Link>
          </div>
          <div className="flex gap-4 font-semibold text-slate-900">
             <span className="flex items-center gap-1"><Globe size={14}/> 한국어 (KR)</span>
             <span>₩ KRW</span>
          </div>
        </div>
      </footer>
    </div>
  );
}