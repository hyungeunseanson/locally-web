'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Globe } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import MainSearchBar from '@/app/components/MainSearchBar';
import ExperienceCard from '@/app/components/ExperienceCard';
import ServiceCard from '@/app/components/ServiceCard';
import { CATEGORIES, LOCALLY_SERVICES } from '@/app/constants';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'experience' | 'service'>('experience');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [experiences, setExperiences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 검색 관련 상태
  const [activeSearchField, setActiveSearchField] = useState<'location' | 'date' | null>(null);
  const [locationInput, setLocationInput] = useState('');
  const [dateRange, setDateRange] = useState<{start: Date | null, end: Date | null}>({ start: null, end: null });
  
  const searchRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const isScrolled = scrollY > 20;
  const supabase = createClient();

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
      if (window.scrollY > 50) setActiveSearchField(null);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setActiveSearchField(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchExperiences = async () => {
      try {
        let query = supabase
          .from('experiences')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false });
        
        const { data, error } = await query;
        if (error) throw error;
        if (data) setExperiences(data);
      } catch (error) { console.error(error); } 
      finally { setLoading(false); }
    };
    fetchExperiences();
  }, [selectedCategory]);

  // 스크롤 애니메이션 스타일 계산
  const progress = Math.min(scrollY / 50, 1);
  const expandedSearchStyle = {
    opacity: 1 - progress * 2,
    transform: `scale(${1 - progress * 0.2}) translateY(${progress * -20}px)`,
    pointerEvents: isScrolled ? 'none' : 'auto',
    display: progress > 0.8 ? 'none' : 'flex',
  };
  const collapsedSearchStyle = {
    opacity: progress < 0.5 ? 0 : (progress - 0.5) * 2,
    transform: `scale(${0.8 + progress * 0.2}) translateY(0)`,
    pointerEvents: isScrolled ? 'auto' : 'none',
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans relative">
      {/* 1. 상단 고정 헤더 & 축소된 검색바 */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm h-20 transition-shadow">
        <SiteHeader />
        <div 
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center bg-white border border-slate-300 rounded-full shadow-sm hover:shadow-md transition-all h-12 px-2 cursor-pointer z-50"
          style={collapsedSearchStyle as any}
          onClick={() => { window.scrollTo({top: 0, behavior: 'smooth'}); setActiveSearchField('location'); }}
        >
          <div className="px-4 text-sm font-bold text-slate-900 border-r border-slate-300">어디든지</div>
          <div className="px-4 text-sm font-bold text-slate-900 border-r border-slate-300">언제든지</div>
          <div className="px-4 text-sm font-bold text-slate-500">검색</div>
          <button className="w-8 h-8 bg-[#FF385C] rounded-full flex items-center justify-center text-white ml-2"><Search size={14} strokeWidth={3}/></button>
        </div>
      </div>

      {/* 2. 확장된 검색바 & 탭 (스크롤 시 사라짐) */}
      <div className="pt-24 pb-6 px-6 relative z-40 bg-white" ref={searchRef}>
        <div className="flex flex-col items-center relative">
          <div className={`flex gap-8 mb-4 transition-all duration-300 ${isScrolled ? 'opacity-0 -translate-y-10' : 'opacity-100'}`}>
            <button onClick={() => setActiveTab('experience')} className={`pb-2 text-base font-bold flex items-center gap-2 transition-all ${activeTab === 'experience' ? 'text-black border-b-[3px] border-black' : 'text-slate-500 hover:text-slate-800 border-b-[3px] border-transparent'}`}>
              <span className="text-xl">🎈</span> 체험
            </button>
            <button onClick={() => setActiveTab('service')} className={`pb-2 text-base font-bold flex items-center gap-2 transition-all ${activeTab === 'service' ? 'text-black border-b-[3px] border-black' : 'text-slate-500 hover:text-slate-800 border-b-[3px] border-transparent'}`}>
              <span className="text-xl">🛎️</span> 서비스
            </button>
          </div>

          <MainSearchBar 
            activeSearchField={activeSearchField}
            setActiveSearchField={setActiveSearchField}
            locationInput={locationInput}
            setLocationInput={setLocationInput}
            dateRange={dateRange}
            setDateRange={setDateRange}
            onCategorySelect={setSelectedCategory}
            style={expandedSearchStyle}
          />
        </div>
      </div>

      {/* 3. 카테고리 탭 (체험 탭일 때만 표시) */}
      {activeTab === 'experience' && (
        <div className="bg-white pb-6 pt-2 border-b border-slate-100">
          <div className="max-w-[1760px] mx-auto px-6 md:px-12 flex justify-center">
            <div className="flex items-center gap-12 overflow-x-auto no-scrollbar pb-2">
              {CATEGORIES.map((cat) => (
                <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`flex flex-col items-center gap-2 min-w-fit pb-2 transition-all border-b-2 cursor-pointer group ${selectedCategory === cat.id ? 'border-black opacity-100' : 'border-transparent opacity-60 hover:opacity-100 hover:border-slate-200'}`}>
                  <span className="text-3xl transition-transform group-hover:scale-110">{cat.icon}</span>
                  <span className={`text-xs font-bold whitespace-nowrap ${selectedCategory === cat.id ? 'text-black' : 'text-slate-600'}`}>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. 메인 콘텐츠 (리스트) */}
      <main className="max-w-[1760px] mx-auto px-6 md:px-12 py-8 min-h-screen">
        {activeTab === 'experience' && (
          loading ? (
            <div className="flex justify-center py-40"><div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-black"></div></div>
          ) : experiences.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-40 text-center">
              <div className="text-4xl mb-4">🌏</div>
              <h3 className="text-lg font-bold text-slate-900">아직 등록된 체험이 없습니다.</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-6 gap-y-10">
              {experiences.map((item) => <ExperienceCard key={item.id} item={item} />)}
            </div>
          )
        )}

        {activeTab === 'service' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
            {LOCALLY_SERVICES.map((item) => <ServiceCard key={item.id} item={item} />)}
          </div>
        )}
      </main>

      {/* 5. 푸터 */}
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
                <li><Link href="/become-a-host" className="hover:underline">호스트 되기</Link></li>
                <li><Link href="#" className="hover:underline">호스트 추천하기</Link></li>
                <li><Link href="#" className="hover:underline">책임 보험</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="font-bold text-black mb-4">지원</h5>
              <ul className="space-y-3">
                <li><Link href="#" className="hover:underline">도움말 센터</Link></li>
                <li><Link href="#" className="hover:underline">안전 센터</Link></li>
                <li><Link href="#" className="hover:underline">예약 취소 옵션</Link></li>
                <li><Link href="#" className="hover:underline">장애인 지원</Link></li>
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