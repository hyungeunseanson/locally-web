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
  
  const [allExperiences, setAllExperiences] = useState<any[]>([]); // ✅ 전체 데이터 원본
  const [filteredExperiences, setFilteredExperiences] = useState<any[]>([]); // ✅ 화면에 보여줄 필터링된 데이터
  const [loading, setLoading] = useState(true);
  
  const [activeSearchField, setActiveSearchField] = useState<'location' | 'date' | null>(null);
  const [locationInput, setLocationInput] = useState('');
  const [dateRange, setDateRange] = useState<{start: Date | null, end: Date | null}>({ start: null, end: null });
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

  // 📡 데이터 가져오기 (카테고리 변경 시)
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
          // 카테고리 필터링 (DB에서 가져온 후 적용)
          let categoryFiltered = data;
          if (selectedCategory !== 'all') {
            // DB에 category 필드가 없으면 location이나 title로 임시 필터링
            // 만약 DB에 category 컬럼이 있다면: item.category === selectedCategory 로 수정
            categoryFiltered = data.filter((item: any) => 
              item.location?.includes(selectedCategory) || item.title?.includes(selectedCategory)
            );
          }

          setAllExperiences(categoryFiltered);
          setFilteredExperiences(categoryFiltered); // 초기엔 전체 보여줌
        }
      } catch (error) { console.error(error); } 
      finally { setLoading(false); }
    };
    fetchExperiences();
  }, [selectedCategory]);

  // 🔍 통합 검색 함수
  const handleSearch = () => {
    if (!locationInput.trim()) {
      setFilteredExperiences(allExperiences); // 검색어 없으면 전체 목록 복구
      return;
    }

    const term = locationInput.toLowerCase();
    
    // 제목, 지역, 설명, 카테고리(있다면) 중 하나라도 포함되면 노출
    const result = allExperiences.filter((item) => 
      (item.title && item.title.toLowerCase().includes(term)) ||
      (item.location && item.location.toLowerCase().includes(term)) ||
      (item.description && item.description.toLowerCase().includes(term))
    );

    setFilteredExperiences(result);
    setActiveSearchField(null); // 검색 후 창 닫기
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans relative">
      
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
        searchRef={searchRef}
        onSearch={handleSearch} // ✅ 검색 함수 전달
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
          ) : filteredExperiences.length === 0 ? ( // ✅ filteredExperiences 사용
            <div className="flex flex-col items-center justify-center py-40 text-center">
              <Ghost size={48} className="text-slate-300 mb-4"/>
              <h3 className="text-lg font-bold text-slate-900 mb-2">검색 결과가 없습니다.</h3>
              <p className="text-slate-500 text-sm">다른 키워드로 검색해보세요!</p>
              <button onClick={() => { setLocationInput(''); setFilteredExperiences(allExperiences); }} className="mt-6 px-6 py-3 bg-slate-100 text-slate-900 rounded-xl font-bold hover:bg-slate-200 transition-colors">전체 목록 보기</button>
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