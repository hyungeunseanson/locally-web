'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Globe, Ghost } from 'lucide-react'; // Ghost 아이콘 추가 (빈화면용)
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
  
  // 검색 및 스크롤 상태
  const [activeSearchField, setActiveSearchField] = useState<'location' | 'date' | null>(null);
  const [locationInput, setLocationInput] = useState('');
  const [dateRange, setDateRange] = useState<{start: Date | null, end: Date | null}>({ start: null, end: null });
  const [scrollY, setScrollY] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // 스크롤 감지
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
      if (window.scrollY > 50) setActiveSearchField(null);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isScrolled = scrollY > 50;

  // 외부 클릭 감지 (검색창 닫기)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setActiveSearchField(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 데이터 로딩
  useEffect(() => {
    const fetchExperiences = async () => {
      setLoading(true);
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

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans relative">
      
      {/* 🟢 1. 상단 헤더 & Sticky 검색바 */}
      <div className={`fixed top-0 left-0 right-0 z-50 bg-white transition-shadow duration-300 ${isScrolled ? 'shadow-sm' : ''} h-20`}>
        <SiteHeader />
        
        {/* 스크롤 시 나타나는 작은 검색바 */}
        <div 
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center bg-white border border-slate-300 rounded-full shadow-sm hover:shadow-md h-12 px-2 cursor-pointer z-[100] transition-all duration-300 ease-in-out ${isScrolled ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-75 pointer-events-none'}`}
          onClick={() => { window.scrollTo({top: 0, behavior: 'smooth'}); setActiveSearchField('location'); }}
        >
          <div className="px-4 text-sm font-bold text-slate-900 border-r border-slate-300">어디든지</div>
          <div className="px-4 text-sm font-bold text-slate-900 border-r border-slate-300">언제든지</div>
          <div className="px-4 text-sm font-bold text-slate-500">게스트 추가</div>
          <button className="w-8 h-8 bg-[#FF385C] rounded-full flex items-center justify-center text-white ml-2">
            <Search size={14} strokeWidth={3}/>
          </button>
        </div>
      </div>

      {/* 🟢 2. 메인 검색바 & 탭 */}
      <div className="pt-24 pb-6 px-6 relative z-40 bg-white" ref={searchRef}>
        <div className="flex flex-col items-center relative">
          
          {/* 탭 버튼 */}
          <div className={`flex gap-8 mb-4 transition-all duration-300 ${isScrolled ? 'opacity-0 -translate-y-4 pointer-events-none h-0 mb-0 overflow-hidden' : 'opacity-100 translate-y-0 h-auto'}`}>
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
            isVisible={!isScrolled} 
          />
        </div>
      </div>

      {/* 🟢 3. 카테고리 필터 */}
      {activeTab === 'experience' && (
        <div className={`bg-white pb-4 pt-2 border-b border-slate-100 sticky top-20 z-30 transition-all duration-300 ${isScrolled ? 'shadow-sm pt-4' : ''}`}>
          <div className="max-w-[1760px] mx-auto px-6 md:px-12 flex justify-center">
            <div className="flex items-center gap-8 overflow-x-auto no-scrollbar pb-2 w-full justify-start md:justify-center">
              {CATEGORIES.map((cat) => (
                <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`flex flex-col items-center gap-2 min-w-fit pb-2 transition-all border-b-2 cursor-pointer group ${selectedCategory === cat.id ? 'border-black opacity-100' : 'border-transparent opacity-60 hover:opacity-100 hover:border-slate-200'}`}>
                  <span className="text-2xl transition-transform group-hover:scale-110">{cat.icon}</span>
                  <span className={`text-xs font-bold whitespace-nowrap ${selectedCategory === cat.id ? 'text-black' : 'text-slate-600'}`}>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🟢 4. 콘텐츠 리스트 */}
      <main className="max-w-[1760px] mx-auto px-6 md:px-12 py-8 min-h-screen">
        {activeTab === 'experience' && (
          loading ? (
            // 스켈레톤 로딩 (앱 같은 느낌!)
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-6 gap-y-10">
              {[1,2,3,4,5,6,7,8].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="bg-slate-200 aspect-[4/3] rounded-xl mb-3"></div>
                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : experiences.length === 0 ? (
            // 빈 화면 (Empty State)
            <div className="flex flex-col items-center justify-center py-40 text-center">
              <Ghost size={48} className="text-slate-300 mb-4"/>
              <h3 className="text-lg font-bold text-slate-900 mb-2">등록된 체험이 없습니다.</h3>
              <p className="text-slate-500 text-sm">첫 번째 체험을 등록해보세요!</p>
              <Link href="/become-a-host" className="mt-6 px-6 py-3 bg-black text-white rounded-xl font-bold hover:scale-105 transition-transform">호스트 되기</Link>
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

      {/* 🟢 5. 푸터 */}
      <Footer />
    </div>
  );
}

// 푸터 컴포넌트 분리
function Footer() {
  return (
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
  );
}