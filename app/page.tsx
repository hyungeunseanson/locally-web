'use client';

import React, { useState, useEffect } from 'react';
import { Heart, Star, MapPin, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { supabase } from './lib/supabase';
// ✅ 우리가 만든 '똑똑한 헤더' 가져오기
import SiteHeader from '@/app/components/SiteHeader';

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
  const [experiences, setExperiences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 데이터 불러오기 로직 (그대로 유지)
  useEffect(() => {
    const fetchExperiences = async () => {
      try {
        let query = supabase
          .from('experiences')
          .select('*')
          .order('created_at', { ascending: false });
        
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
  }, [selectedCategory]);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      
      {/* ✅ [수정 완료] 옛날 헤더 삭제하고, 기능 완벽한 SiteHeader 장착! */}
      <SiteHeader />

      {/* 2. Category Filter */}
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

      {/* 3. Main Content */}
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

      {/* Footer */}
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