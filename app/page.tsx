'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Globe, Ghost } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client';
import HomeHero from '@/app/components/HomeHero'; 
import ExperienceCard from '@/app/components/ExperienceCard';
import ServiceCard from '@/app/components/ServiceCard';
import { LOCALLY_SERVICES } from '@/app/constants';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'experience' | 'service'>('experience');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const [allExperiences, setAllExperiences] = useState<any[]>([]); 
  const [filteredExperiences, setFilteredExperiences] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  
  const [activeSearchField, setActiveSearchField] = useState<'location' | 'date' | 'language' | null>(null);
  const [locationInput, setLocationInput] = useState('');
  const [dateRange, setDateRange] = useState<{start: Date | null, end: Date | null}>({ start: null, end: null });
  const [selectedLanguage, setSelectedLanguage] = useState('all'); // ✅ 언어 상태 추가
  
  const [scrollY, setScrollY] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  
  const supabase = createClient();

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
      if (window.scrollY > 50) setActiveSearchField(null);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isScrolled = scrollY > 50;

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
      setLoading(true);
      try {
        let query = supabase
          .from('experiences')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false });
        
        const { data, error } = await query;
        if (error) throw error;
        
        if (data) {
          let categoryFiltered = data;
          if (selectedCategory !== 'all') {
            categoryFiltered = data.filter((item: any) => 
              item.location?.includes(selectedCategory) || item.title?.includes(selectedCategory)
            );
          }
          setAllExperiences(categoryFiltered);
          setFilteredExperiences(categoryFiltered); 
        }
      } catch (error) { console.error(error); } 
      finally { setLoading(false); }
    };
    fetchExperiences();
  }, [selectedCategory]);

  // // 🔍 통합 검색 함수 (언어 필터 추가)
  // const handleSearch = () => {
  //   let result = allExperiences;

  //   // 1. 텍스트 검색
  //   if (locationInput.trim()) {
  //     const term = locationInput.toLowerCase();
  //     result = result.filter((item) => 
  //       (item.title && item.title.toLowerCase().includes(term)) ||
  //       (item.location && item.location.toLowerCase().includes(term)) ||
  //       (item.description && item.description.toLowerCase().includes(term))
  //     );
  //   }

  //   // 2. 언어 필터링
  //   if (selectedLanguage !== 'all') {
  //     result = result.filter((item) => 
  //       item.languages && item.languages.includes(selectedLanguage)
  //     );
  //   }

  //   setFilteredExperiences(result);
  //   setActiveSearchField(null); 
  // };

  // HomeHero에 Props 전달을 위해 래퍼 컴포넌트 수정 필요 (아래 코드 참고)
  // (HomeHero.tsx도 Props 타입 수정이 필요하지만, 여기서는 핵심 로직만 보여드립니다.)

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans relative">
      
      {/* 🟢 HomeHero에 언어 관련 Props 전달 */}
      <HomeHero 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        isScrolled={isScrolled}
        activeSearchField={activeSearchField}
        setActiveSearchField={setActiveSearchField}
        locationInput={locationInput}
        setLocationInput={setLocationInput}
        dateRange={dateRange}
        setDateRange={setDateRange}
        // 👇 추가된 부분
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
        // 👆
        searchRef={searchRef}
        // onSearch={handleSearch} 
      />

      <main className="max-w-[1760px] mx-auto px-6 md:px-12 py-8 min-h-screen">
        {activeTab === 'experience' && (
          loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-6 gap-y-10">
              {[1,2,3,4,5,6,7,8].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="bg-slate-200 aspect-[4/3] rounded-xl mb-3"></div>
                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : filteredExperiences.length === 0 ? ( 
            <div className="flex flex-col items-center justify-center py-40 text-center">
              <Ghost size={48} className="text-slate-300 mb-4"/>
              <h3 className="text-lg font-bold text-slate-900 mb-2">검색 결과가 없습니다.</h3>
              <p className="text-slate-500 text-sm">다른 키워드나 언어로 검색해보세요!</p>
              <button onClick={() => { setLocationInput(''); setSelectedLanguage('all'); setFilteredExperiences(allExperiences); }} className="mt-6 px-6 py-3 bg-slate-100 text-slate-900 rounded-xl font-bold hover:bg-slate-200 transition-colors">전체 목록 보기</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-6 gap-y-10">
              {filteredExperiences.map((item) => <ExperienceCard key={item.id} item={item} />)}
            </div>
          )
        )}

        {activeTab === 'service' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
            {LOCALLY_SERVICES.map((item) => <ServiceCard key={item.id} item={item} />)}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function Footer() {
  return (
    // ✅ z-50으로 설정하여 다른 요소에 가려 클릭이 안 되는 문제를 확실히 해결했습니다.
    <footer className="border-t border-slate-100 bg-slate-50 mt-20 relative z-50">
      <div className="max-w-[1760px] mx-auto px-6 md:px-12 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-sm text-slate-500">
          
          {/* 1. Locally */}
          <div>
            <h5 className="font-bold text-black mb-4">Locally</h5>
            <ul className="space-y-3">
              <li><Link href="/about" className="hover:underline">회사 소개</Link></li>
              <li><Link href="/admin/dashboard" className="hover:underline font-bold text-slate-800">관리자 페이지</Link></li>
            </ul>
          </div>

          {/* 2. 호스팅 */}
          <div>
            <h5 className="font-bold text-black mb-4">호스팅</h5>
            <ul className="space-y-3">
              <li><Link href="/become-a-host" className="hover:underline">호스트 되기</Link></li>
              <li><Link href="#" className="hover:underline">호스트 추천하기</Link></li>
            </ul>
          </div>

          {/* 3. 지원 (도움말 센터 연결됨) */}
          <div>
            <h5 className="font-bold text-black mb-4">지원</h5>
            <ul className="space-y-3">
              {/* ✅ href="/help"로 정확히 연결 */}
              <li><Link href="/help" className="hover:underline">도움말 센터</Link></li>
              <li><Link href="#" className="hover:underline">안전 센터</Link></li>
            </ul>
          </div>

          {/* 4. 하단 정보 (언어, 통화, 저작권) */}
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