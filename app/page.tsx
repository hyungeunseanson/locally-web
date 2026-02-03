'use client';

import React, { useState, useEffect } from 'react';
import { 
  Heart, Star, MapPin, Search, Globe, SlidersHorizontal, 
  TentTree, ConciergeBell // 아이콘 추가
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';

// 카테고리 데이터
const CATEGORIES = [
  { id: 'all', label: '전체', icon: '🌍' },
  { id: 'culture', label: '도쿄', icon: '🗼' },
  { id: 'food', label: '음식/투어', icon: '🍳' },
  { id: 'nature', label: '자연/야외', icon: '🌲' },
  { id: 'night', label: '나이트라이프', icon: '🍸' },
  { id: 'class', label: '원데이클래스', icon: '🧶' },
  { id: 'snap', label: '스냅사진', icon: '📸' },
  { id: 'shopping', label: '쇼핑', icon: '🛍️' },
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
  
  // 스크롤 상태 관리
  const [scrollY, setScrollY] = useState(0);
  const isScrolled = scrollY > 20; // 스크롤이 조금이라도 발생했는지

  const supabase = createClient();

  // 스크롤 이벤트 핸들러
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 체험 데이터 로딩
  useEffect(() => {
    const fetchExperiences = async () => {
      try {
        let query = supabase.from('experiences').select('*').order('created_at', { ascending: false });
        if (selectedCategory !== 'all') query = query.eq('category', selectedCategory);
        
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

  // 스크롤에 따른 동적 스타일 계산
  // scrollY가 0에서 80까지 변할 때 progress는 0에서 1로 변함
  const progress = Math.min(scrollY / 80, 1);
  
  const searchContainerStyle = {
    height: `${180 - progress * 100}px`, // 180px -> 80px로 줄어듦
    boxShadow: isScrolled ? '0 4px 20px rgba(0,0,0,0.08)' : 'none',
  };

  const expandedSearchStyle = {
    opacity: 1 - progress * 1.5, // 빠르게 투명해짐
    transform: `scale(${1 - progress * 0.1}) translateY(${progress * 20}px)`, // 약간 작아지면서 아래로 이동
    pointerEvents: progress > 0.5 ? 'none' : 'auto', // 반 이상 넘어가면 클릭 불가
  };

  const collapsedSearchStyle = {
    opacity: progress < 0.3 ? 0 : (progress - 0.3) * 2, // 조금 늦게 나타나기 시작해서 빠르게 불투명해짐
    transform: `scale(${0.8 + progress * 0.2}) translateY(${20 - progress * 20}px)`, // 작았다가 커지면서 제자리로
    pointerEvents: progress > 0.5 ? 'auto' : 'none',
  };


  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      
      {/* 1. Header (로고, 프로필) - 고정 */}
      <div className="bg-white z-50 relative border-b border-transparent">
        <SiteHeader />
      </div>

      {/* 2. Dynamic Search & Tabs Area (스크롤에 따라 변형 및 고정) */}
      <div 
        className="sticky top-[80px] z-40 bg-white border-b border-slate-100 transition-all duration-200 ease-out overflow-hidden"
        style={searchContainerStyle}
      >
        <div className="flex flex-col items-center h-full relative">
          
          {/* 상단 탭 (체험 | 서비스) - 아이콘 추가됨 */}
          <div className={`flex gap-8 mt-6 transition-all duration-200 ${isScrolled ? 'opacity-0 translate-y-[-20px]' : 'opacity-100'}`}>
            <button 
              onClick={() => setActiveTab('experience')}
              className={`pb-2 text-base font-bold transition-all flex items-center gap-2 ${activeTab === 'experience' ? 'text-black border-b-[3px] border-black' : 'text-slate-500 hover:text-slate-800 hover:border-slate-300 border-b-[3px] border-transparent'}`}
            >
              <TentTree size={20} /> 체험
            </button>
            <button 
              onClick={() => setActiveTab('service')}
              className={`pb-2 text-base font-bold transition-all flex items-center gap-2 ${activeTab === 'service' ? 'text-black border-b-[3px] border-black' : 'text-slate-500 hover:text-slate-800 hover:border-slate-300 border-b-[3px] border-transparent'}`}
            >
              <ConciergeBell size={20} /> 서비스
            </button>
          </div>

          {/* 검색바 컨테이너 (중앙 정렬을 위해 relative 설정) */}
          <div className="absolute w-full flex justify-center bottom-6 px-6">
            
            {/* A. 펼쳐진 검색바 (스크롤 내리면 사라짐) */}
            <div 
              className="flex items-center bg-white border border-slate-200 rounded-full shadow-lg hover:shadow-xl transition-all w-full max-w-2xl h-16 origin-center"
              style={expandedSearchStyle as any}
            >
              <div className="flex-1 px-8 border-r border-slate-200 h-full flex flex-col justify-center hover:bg-slate-50 rounded-l-full cursor-pointer group">
                <label className="text-[10px] font-bold uppercase text-slate-800 group-hover:text-black">여행지</label>
                <input type="text" placeholder="여행지 검색" className="w-full text-sm outline-none bg-transparent placeholder:text-slate-400 text-black font-semibold truncate"/>
              </div>
              <div className="flex-1 px-8 h-full flex flex-col justify-center hover:bg-slate-50 cursor-pointer group relative">
                <label className="text-[10px] font-bold uppercase text-slate-800 group-hover:text-black">날짜</label>
                <input type="text" placeholder="날짜 추가" className="w-full text-sm outline-none bg-transparent placeholder:text-slate-400 text-black font-semibold truncate"/>
              </div>
              <div className="pr-2 pl-2">
                <button className="w-12 h-12 bg-rose-500 hover:bg-rose-600 rounded-full flex items-center justify-center text-white transition-transform active:scale-95">
                  <Search size={20} strokeWidth={2.5}/>
                </button>
              </div>
            </div>

            {/* B. 축소된 검색바 (스크롤 내리면 나타남) */}
            <div 
              className="absolute flex items-center bg-white border border-slate-300 rounded-full shadow-sm hover:shadow-md transition-all h-12 px-2 origin-center cursor-pointer"
              style={{ ...collapsedSearchStyle as any, top: '50%', transform: `${collapsedSearchStyle.transform} translateY(-50%)` }}
            >
              <div className="px-4 text-sm font-semibold text-slate-900 border-r border-slate-300">
                어디든지
              </div>
              <div className="px-4 text-sm font-semibold text-slate-900">
                언제든지
              </div>
              <button className="w-8 h-8 bg-rose-500 rounded-full flex items-center justify-center text-white">
                <Search size={14} strokeWidth={3}/>
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* 3. Category Filter (스크롤 시 따라오지 않음) */}
      {activeTab === 'experience' && (
        <div className="bg-white border-b border-slate-100 pt-4">
          <div className="max-w-[1760px] mx-auto px-6 md:px-12 flex items-center gap-4">
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
            <button className="hidden md:flex items-center gap-2 border border-slate-300 rounded-xl px-4 py-3 text-xs font-bold hover:border-black hover:bg-slate-50 transition-colors shrink-0">
              <SlidersHorizontal size={16} /> 필터
            </button>
          </div>
        </div>
      )}

      {/* 4. Main Content Grid */}
      <main className="max-w-[1760px] mx-auto px-6 md:px-12 py-8 min-h-screen">
        {/* ... (이전과 동일한 콘텐츠 영역 코드) ... */}
        {/* A. 체험 리스트 */}
        {activeTab === 'experience' && (
          loading ? (
            <div className="flex justify-center py-40"><div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-black"></div></div>
          ) : experiences.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-40 text-center">
              <div className="text-4xl mb-4">😢</div>
              <h3 className="text-lg font-bold text-slate-900">등록된 체험이 없습니다.</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-12">
              {experiences.map((item) => (
                <ExperienceCard key={item.id} item={item} />
              ))}
            </div>
          )
        )}

        {/* B. 서비스 리스트 */}
        {activeTab === 'service' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12">
            {LOCALLY_SERVICES.map((item) => (
              <ServiceCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-slate-50 mt-20">
        {/* ... (이전과 동일한 푸터 코드) ... */}
        <div className="max-w-[1760px] mx-auto px-6 md:px-12 py-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-sm text-slate-500">
            <div>
              <h5 className="font-bold text-black mb-4">Locally</h5>
              <ul className="space-y-3">
                <li><Link href="#" className="hover:underline">회사 소개</Link></li>
                <li><Link href="#" className="hover:underline">채용 정보</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="font-bold text-black mb-4">호스팅</h5>
              <ul className="space-y-3">
                <li><Link href="/host/register" className="hover:underline">호스트 되기</Link></li>
                <li><Link href="#" className="hover:underline">호스트 자료</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="font-bold text-black mb-4">고객 지원</h5>
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

// 📌 1080x1350 비율 (aspect-[4/5]) 카드 컴포넌트
function ExperienceCard({ item }: any) {
  return (
    <Link href={`/experiences/${item.id}`} className="block group">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-slate-200 mb-3 border border-slate-100">
        <img 
          src={item.image_url || "https://images.unsplash.com/photo-1542051841857-5f90071e7989"} 
          alt={item.title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <button className="absolute top-3 right-3 text-white/70 hover:text-white hover:scale-110 transition-all z-10">
          <Heart size={24} fill="rgba(0,0,0,0.5)" strokeWidth={2} />
        </button>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-slate-900 truncate pr-2">{item.location || '서울'} · {item.category}</h3>
          <div className="flex items-center gap-1 text-sm shrink-0">
            <Star size={14} fill="black" />
            <span>4.9</span>
          </div>
        </div>
        <p className="text-sm text-slate-500 line-clamp-1">{item.title}</p>
        <div className="mt-1">
          <span className="font-bold text-slate-900">₩{Number(item.price).toLocaleString()}</span>
          <span className="text-sm text-slate-900"> / 인</span>
        </div>
      </div>
    </Link>
  )
}

// 📌 서비스 카드 컴포넌트 (동일 비율)
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
           <h3 className="font-bold text-lg leading-tight">{item.title}</h3>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-sm text-slate-500 line-clamp-2">{item.desc}</p>
        <div className="mt-1 font-bold text-slate-900">
          ₩{item.price.toLocaleString()}부터
        </div>
      </div>
    </div>
  )
}