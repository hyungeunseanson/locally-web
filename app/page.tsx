'use client';

import React, { useState, useEffect } from 'react';
import { 
  Heart, Star, MapPin, Search, Globe, SlidersHorizontal, ChevronRight 
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader'; // 기존 헤더 사용 (내부에서 스타일 조정 필요할 수도 있음)

// 카테고리 데이터
const CATEGORIES = [
  { id: 'all', label: '전체', icon: '🌍' },
  { id: 'culture', label: '문화/예술', icon: '🎨' },
  { id: 'food', label: '음식/투어', icon: '🍳' },
  { id: 'nature', label: '자연/야외', icon: '🌲' },
  { id: 'night', label: '나이트라이프', icon: '🍸' },
  { id: 'class', label: '원데이클래스', icon: '🧶' },
  { id: 'snap', label: '스냅사진', icon: '📸' },
  { id: 'shopping', label: '쇼핑', icon: '🛍️' },
];

export default function HomePage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [experiences, setExperiences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

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
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchExperiences();
  }, [selectedCategory]);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      
      {/* 1. Header (커스텀 헤더 대신 기존 SiteHeader 사용하되, 검색바는 아래에 배치) */}
      <SiteHeader />

      {/* 2. Sticky Category Bar (스크롤해도 상단 고정) */}
      <div className="sticky top-[80px] z-30 bg-white border-b border-slate-100 shadow-sm pt-4">
        <div className="max-w-[1760px] mx-auto px-6 md:px-12 flex items-center gap-4">
          
          {/* 카테고리 리스트 (좌우 스크롤) */}
          <div className="flex-1 flex items-center gap-8 overflow-x-auto no-scrollbar pb-2">
            {CATEGORIES.map((cat) => (
              <button 
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex flex-col items-center gap-2 min-w-[64px] pb-3 transition-all border-b-2 cursor-pointer group ${
                  selectedCategory === cat.id 
                    ? 'border-black text-black opacity-100' 
                    : 'border-transparent text-slate-500 opacity-60 hover:opacity-100 hover:border-slate-200'
                }`}
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">{cat.icon}</span>
                <span className="text-xs font-semibold whitespace-nowrap">{cat.label}</span>
              </button>
            ))}
          </div>

          {/* 필터 버튼 (오른쪽 고정) */}
          <button className="hidden md:flex items-center gap-2 border border-slate-300 rounded-xl px-4 py-3 text-xs font-bold hover:border-black hover:bg-slate-50 transition-colors shrink-0">
            <SlidersHorizontal size={16} /> 필터
          </button>

        </div>
      </div>

      {/* 3. Main Content Grid */}
      <main className="max-w-[1760px] mx-auto px-6 md:px-12 py-8">
        
        {loading ? (
          <div className="flex justify-center py-40">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-black"></div>
          </div>
        ) : experiences.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40 text-center">
            <div className="text-4xl mb-4">😢</div>
            <h3 className="text-lg font-bold text-slate-900">등록된 체험이 없습니다.</h3>
            <p className="text-slate-500 text-sm mt-2">다른 카테고리를 선택하거나, 호스트가 되어보세요!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-6 gap-y-10">
            {experiences.map((item) => (
              <ExperienceCard key={item.id} item={item} />
            ))}
          </div>
        )}

      </main>

      {/* 4. Floating Map Button (모바일용) */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 md:hidden">
        <button className="bg-black text-white px-5 py-3 rounded-full font-bold shadow-xl flex items-center gap-2 text-sm hover:scale-105 transition-transform">
          <MapPin size={16} /> 지도 표시
        </button>
      </div>

      {/* 5. Footer */}
      <footer className="border-t border-slate-100 bg-slate-50 mt-20">
        <div className="max-w-[1760px] mx-auto px-6 md:px-12 py-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-sm text-slate-500">
            <div>
              <h5 className="font-bold text-black mb-4">고객 지원</h5>
              <ul className="space-y-3">
                <li><Link href="#" className="hover:underline">도움말 센터</Link></li>
                <li><Link href="#" className="hover:underline">에어커버</Link></li>
                <li><Link href="#" className="hover:underline">차별 반대</Link></li>
                <li><Link href="#" className="hover:underline">장애인 지원</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="font-bold text-black mb-4">호스팅</h5>
              <ul className="space-y-3">
                <li><Link href="/host/register" className="hover:underline">호스트 되기</Link></li>
                <li><Link href="#" className="hover:underline">호스트 책임보험</Link></li>
                <li><Link href="#" className="hover:underline">커뮤니티 포럼</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="font-bold text-black mb-4">Locally</h5>
              <ul className="space-y-3">
                <li><Link href="#" className="hover:underline">뉴스룸</Link></li>
                <li><Link href="#" className="hover:underline">새로운 기능</Link></li>
                <li><Link href="#" className="hover:underline">채용 정보</Link></li>
                <li><Link href="#" className="hover:underline">투자자 정보</Link></li>
              </ul>
            </div>
            <div>
               <div className="flex gap-4 font-bold text-slate-900 mb-6">
                 <button className="flex items-center gap-1 hover:underline"><Globe size={16}/> 한국어 (KR)</button>
                 <button className="hover:underline">₩ KRW</button>
               </div>
               <p className="text-xs">© 2026 Locally, Inc.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ✨ 에어비앤비 스타일 카드 컴포넌트
function ExperienceCard({ item }: any) {
  return (
    <Link href={`/experiences/${item.id}`} className="block group">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-200 mb-3 border border-slate-100">
        {/* 이미지 */}
        <img 
          src={item.image_url || "https://images.unsplash.com/photo-1542051841857-5f90071e7989"} 
          alt={item.title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        
        {/* 찜하기 버튼 (우상단) */}
        <button className="absolute top-3 right-3 text-white/70 hover:text-white hover:scale-110 transition-all z-10">
          <Heart size={24} fill="rgba(0,0,0,0.5)" strokeWidth={2} />
        </button>

        {/* 게스트 선호 배지 (좌상단 - 예시) */}
        {Math.random() > 0.7 && (
          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded shadow-sm text-[10px] font-bold text-black">
            게스트 선호
          </div>
        )}
      </div>

      {/* 텍스트 정보 */}
      <div className="space-y-1">
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-slate-900 truncate pr-4">{item.location || '서울'} · {item.category || '체험'}</h3>
          <div className="flex items-center gap-1 text-sm shrink-0">
            <Star size={14} fill="black" />
            <span>4.95</span>
          </div>
        </div>
        
        <p className="text-sm text-slate-500 line-clamp-1">{item.title}</p>
        <p className="text-sm text-slate-500">2월 15일 ~ 20일</p>
        
        <div className="mt-1 flex items-baseline gap-1">
          <span className="font-bold text-slate-900">₩{Number(item.price).toLocaleString()}</span>
          <span className="text-sm text-slate-900">/ 인</span>
        </div>
      </div>
    </Link>
  )
}