'use client';

import React, { useState, useEffect } from 'react';
import { 
  Heart, Star, MapPin, Search, Globe, SlidersHorizontal, 
  TentTree, ConciergeBell, Map
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';

// ✅ 카테고리: 도시 이름으로 변경 (아이콘/이모지 활용)
const CATEGORIES = [
  { id: 'all', label: '전체', icon: '🌏' },
  { id: 'tokyo', label: '도쿄', icon: '🗼' },
  { id: 'osaka', label: '오사카', icon: '🏯' },
  { id: 'fukuoka', label: '후쿠오카', icon: '🍜' },
  { id: 'sapporo', label: '홋카이도', icon: '☃️' },
  { id: 'nagoya', label: '나고야', icon: '🍣' },
  { id: 'seoul', label: '서울', icon: '🏙️' },
  { id: 'busan', label: '부산', icon: '🚢' },
  { id: 'jeju', label: '제주', icon: '🏔️' },
];

// 로컬리 자체 서비스
const LOCALLY_SERVICES = [
  { id: 1, title: '일본 식당 전화 예약 대행', price: 5000, image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b', desc: '한국어 대응 불가 식당, 대신 예약해드립니다.' },
  { id: 2, title: '일본 전세 버스 대절 서비스', price: 350000, image: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e', desc: '단체 여행을 위한 쾌적한 버스 대절.' },
  { id: 3, title: '현지 비즈니스 통역 파견', price: 200000, image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df', desc: '중요한 미팅, 전문 통역사가 함께합니다.' },
  { id: 4, title: '팝업 스토어 스태프 인력', price: 15000, image: 'https://images.unsplash.com/photo-1556742049-0cfed4f7a07d', desc: '일본 현지 행사/팝업 운영 인력 지원.' },
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'experience' | 'service'>('experience');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [experiences, setExperiences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 스크롤 상태
  const [scrollY, setScrollY] = useState(0);
  const isScrolled = scrollY > 20;

  const supabase = createClient();

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const fetchExperiences = async () => {
      try {
        let query = supabase.from('experiences').select('*').order('created_at', { ascending: false });
        // 도시 필터링 로직 (실제로는 DB에 city 컬럼이 있거나 location에서 like 검색을 해야 함. 여기서는 임시로 category 필드 사용)
        // 만약 실제 도시 필터링을 원하시면 DB 쿼리를 .ilike('location', `%${selectedCategory}%`) 등으로 바꾸면 됩니다.
        if (selectedCategory !== 'all') {
           // 임시: 카테고리가 '도시'라면 location 검색, 아니면 category 검색 등 유연하게 처리
           // 여기서는 기존 로직 유지하되, 추후 수정 가능
           // query = query.ilike('location', `%${CATEGORIES.find(c=>c.id===selectedCategory)?.label}%`); 
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

  // 애니메이션 스타일 계산
  const progress = Math.min(scrollY / 80, 1);
  const searchContainerStyle = {
    height: `${180 - progress * 100}px`,
    boxShadow: isScrolled ? '0 4px 20px rgba(0,0,0,0.05)' : 'none',
  };
  
  const expandedSearchStyle = {
    opacity: 1 - progress * 1.5,
    transform: `scale(${1 - progress * 0.1}) translateY(${progress * 20}px)`,
    pointerEvents: progress > 0.5 ? 'none' : 'auto',
  };

  const collapsedSearchStyle = {
    opacity: progress < 0.3 ? 0 : (progress - 0.3) * 2,
    transform: `scale(${0.8 + progress * 0.2}) translateY(${20 - progress * 20}px)`,
    pointerEvents: progress > 0.5 ? 'auto' : 'none',
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      
      {/* 1. Header */}
      <div className="bg-white z-50 relative">
        <SiteHeader />
      </div>

      {/* 2. Search & Tabs Area (애니메이션 적용) */}
      <div 
        className="sticky top-[80px] z-40 bg-white border-b border-slate-100 transition-all duration-200 ease-out"
        style={searchContainerStyle}
      >
        <div className="flex flex-col items-center h-full relative">
          
          {/* 상단 탭 (체험 | 서비스) */}
          <div className={`flex gap-8 mt-4 transition-all duration-200 ${isScrolled ? 'opacity-0 translate-y-[-20px]' : 'opacity-100'}`}>
            <button 
              onClick={() => setActiveTab('experience')}
              className={`pb-2 text-base font-bold transition-all flex items-center gap-2 ${activeTab === 'experience' ? 'text-black border-b-[3px] border-black' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 px-3 rounded-t-lg border-b-[3px] border-transparent'}`}
            >
              체험
            </button>
            <button 
              onClick={() => setActiveTab('service')}
              className={`pb-2 text-base font-bold transition-all flex items-center gap-2 ${activeTab === 'service' ? 'text-black border-b-[3px] border-black' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 px-3 rounded-t-lg border-b-[3px] border-transparent'}`}
            >
              서비스
            </button>
          </div>

          {/* 검색바 컨테이너 */}
          <div className="absolute w-full flex justify-center bottom-6 px-6">
            
            {/* A. 펼쳐진 검색바 (큰 버전) */}
            <div 
              className="flex items-center bg-white border border-slate-200 rounded-full shadow-[0_6px_16px_rgba(0,0,0,0.08)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.12)] transition-shadow w-full max-w-3xl h-[66px] origin-center divide-x divide-slate-200"
              style={expandedSearchStyle as any}
            >
              <div className="flex-[1.5] px-8 h-full flex flex-col justify-center hover:bg-slate-100 rounded-l-full cursor-pointer group">
                <label className="text-[11px] font-bold text-slate-800 group-hover:text-black">여행지</label>
                <input type="text" placeholder="여행지 검색" className="w-full text-sm outline-none bg-transparent placeholder:text-slate-500 text-black font-semibold truncate"/>
              </div>
              <div className="flex-1 px-8 h-full flex flex-col justify-center hover:bg-slate-100 cursor-pointer group">
                <label className="text-[11px] font-bold text-slate-800 group-hover:text-black">날짜</label>
                <input type="text" placeholder="날짜 추가" className="w-full text-sm outline-none bg-transparent placeholder:text-slate-500 text-black font-semibold truncate"/>
              </div>
              <div className="flex-[0.5] pl-4 pr-2 h-full flex items-center justify-end rounded-r-full hover:bg-slate-100 cursor-pointer">
                <button className="w-12 h-12 bg-[#FF385C] hover:bg-[#E00B41] rounded-full flex items-center justify-center text-white transition-transform active:scale-95 shadow-md">
                  <Search size={22} strokeWidth={2.5}/>
                </button>
              </div>
            </div>

            {/* B. 축소된 검색바 (작은 버전) */}
            <div 
              className="absolute flex items-center bg-white border border-slate-200 rounded-full shadow-md hover:shadow-lg transition-all h-12 px-2 origin-center cursor-pointer top-1/2 -translate-y-1/2"
              style={collapsedSearchStyle as any}
            >
              <div className="px-4 text-sm font-semibold text-slate-900 border-r border-slate-300">
                어디든지
              </div>
              <div className="px-4 text-sm font-semibold text-slate-900 border-r border-slate-300">
                언제든지
              </div>
              <div className="px-4 text-sm font-semibold text-slate-500">
                검색
              </div>
              <button className="w-8 h-8 bg-[#FF385C] rounded-full flex items-center justify-center text-white ml-2">
                <Search size={14} strokeWidth={3}/>
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* 3. Category Filter (도시 목록) */}
      {activeTab === 'experience' && (
        <div className="bg-white pt-6 pb-2">
          <div className="max-w-[1760px] mx-auto px-6 md:px-12 flex items-center gap-4">
            <div className="flex-1 flex items-center gap-10 overflow-x-auto no-scrollbar pb-2">
              {CATEGORIES.map((cat) => (
                <button 
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex flex-col items-center gap-2 min-w-fit pb-3 transition-all border-b-2 cursor-pointer group ${
                    selectedCategory === cat.id 
                      ? 'border-black text-black opacity-100' 
                      : 'border-transparent text-slate-500 opacity-60 hover:opacity-100 hover:border-slate-300'
                  }`}
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform filter grayscale group-hover:grayscale-0">{cat.icon}</span>
                  <span className="text-xs font-bold whitespace-nowrap">{cat.label}</span>
                </button>
              ))}
            </div>
            <button className="hidden md:flex items-center gap-2 border border-slate-300 rounded-xl px-4 py-3 text-xs font-bold hover:border-black hover:bg-slate-50 transition-colors shrink-0">
              <SlidersHorizontal size={16} /> 필터
            </button>
          </div>
        </div>
      )}

      {/* 4. Main Content */}
      <main className="max-w-[1760px] mx-auto px-6 md:px-12 py-6 min-h-screen">
        
        {/* A. 체험 리스트 */}
        {activeTab === 'experience' && (
          loading ? (
            <div className="flex justify-center py-40"><div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-black"></div></div>
          ) : experiences.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-40 text-center">
              <div className="text-4xl mb-4">🌏</div>
              <h3 className="text-lg font-bold text-slate-900">아직 등록된 체험이 없습니다.</h3>
              <p className="text-slate-500 text-sm mt-2">첫 번째 호스트가 되어보세요!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-6 gap-y-10">
              {experiences.map((item) => (
                <ExperienceCard key={item.id} item={item} />
              ))}
            </div>
          )
        )}

        {/* B. 서비스 리스트 */}
        {activeTab === 'service' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
            {LOCALLY_SERVICES.map((item) => (
              <ServiceCard key={item.id} item={item} />
            ))}
          </div>
        )}

      </main>

      {/* Footer (관리자 링크 복구) */}
      <footer className="border-t border-slate-100 bg-slate-50 mt-20">
        <div className="max-w-[1760px] mx-auto px-6 md:px-12 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-sm text-slate-500">
            <div>
              <h5 className="font-bold text-black mb-4">Locally</h5>
              <ul className="space-y-3">
                <li><Link href="#" className="hover:underline">회사 소개</Link></li>
                <li><Link href="/admin/dashboard" className="hover:underline font-bold text-slate-800">관리자 페이지</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="font-bold text-black mb-4">호스팅</h5>
              <ul className="space-y-3">
                <li><Link href="/host/register" className="hover:underline">호스트 되기</Link></li>
                <li><Link href="#" className="hover:underline">책임 보험</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="font-bold text-black mb-4">지원</h5>
              <ul className="space-y-3">
                <li><Link href="#" className="hover:underline">도움말 센터</Link></li>
                <li><Link href="#" className="hover:underline">안전 센터</Link></li>
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

// 📌 체험 카드 (4:5 비율, 1080x1350)
function ExperienceCard({ item }: any) {
  return (
    <Link href={`/experiences/${item.id}`} className="block group">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-slate-200 mb-3 border border-transparent group-hover:shadow-md transition-shadow">
        {/* 이미지: 꽉 차게 */}
        <img 
          src={item.image_url || "https://images.unsplash.com/photo-1542051841857-5f90071e7989"} 
          alt={item.title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <button className="absolute top-3 right-3 text-white/70 hover:text-white hover:scale-110 transition-all z-10">
          <Heart size={24} fill="rgba(0,0,0,0.5)" strokeWidth={2} />
        </button>
      </div>

      <div className="space-y-1 px-1">
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-slate-900 text-[15px] truncate pr-2">{item.location || '서울'} · {item.category}</h3>
          <div className="flex items-center gap-1 text-sm shrink-0">
            <Star size={14} fill="black" />
            <span>4.95</span>
            <span className="text-slate-400 font-normal">(32)</span>
          </div>
        </div>
        <p className="text-[15px] text-slate-500 line-clamp-1">{item.title}</p>
        <div className="mt-1">
          <span className="font-bold text-slate-900 text-[15px]">₩{Number(item.price).toLocaleString()}</span>
          <span className="text-[15px] text-slate-900 font-normal"> / 인</span>
        </div>
      </div>
    </Link>
  )
}

// 📌 서비스 카드
function ServiceCard({ item }: any) {
  return (
    <div className="block group cursor-pointer">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-slate-200 mb-3">
        <img 
          src={item.image} 
          alt={item.title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-6 text-white">
           <h3 className="font-bold text-lg leading-tight mb-1">{item.title}</h3>
           <p className="text-sm opacity-90 line-clamp-2">{item.desc}</p>
        </div>
      </div>
      <div className="mt-1 font-bold text-slate-900 px-1">
        ₩{item.price.toLocaleString()}부터
      </div>
    </div>
  )
}