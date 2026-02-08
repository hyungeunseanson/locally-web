'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Globe, Ghost } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client';
import HomeHero from '@/app/components/HomeHero'; 
import ExperienceCard from '@/app/components/ExperienceCard';
import ServiceCard from '@/app/components/ServiceCard';
import { LOCALLY_SERVICES, CATEGORIES } from '@/app/constants'; 
import SiteFooter from '@/app/components/SiteFooter';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'experience' | 'service'>('experience');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const [allExperiences, setAllExperiences] = useState<any[]>([]); 
  const [filteredExperiences, setFilteredExperiences] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  
  // 검색창 상태
  const [activeSearchField, setActiveSearchField] = useState<'location' | 'date' | 'language' | null>(null);
  const [locationInput, setLocationInput] = useState('');
  const [dateRange, setDateRange] = useState<{start: Date | null, end: Date | null}>({ start: null, end: null });
  const [selectedLanguage, setSelectedLanguage] = useState('전체');
  
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

  // 1. 초기 데이터 로드
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
          setAllExperiences(data);
          setFilteredExperiences(data);
        }
      } catch (error) { console.error(error); } 
      finally { setLoading(false); }
    };
    fetchExperiences();
  }, []);

  // 🟢 2. 통합 필터링 함수 (검색 버튼 클릭 or 카테고리 탭 변경 시 실행)
  const applyFilters = () => {
    let result = allExperiences;

    // A. 지역/키워드 필터 (제목, 위치, 설명, ⭐카테고리⭐ 포함)
    if (locationInput.trim()) {
      const term = locationInput.toLowerCase();
      result = result.filter((item) => {
        // 검색 대상 필드들을 하나의 문자열로 합쳐서 검사 (더 강력함)
        const targetString = `
          ${item.title || ''} 
          ${item.location || ''} 
          ${item.description || ''} 
          ${item.category || ''}
        `.toLowerCase();
        
        return targetString.includes(term);
      });
    }

    // B. 언어 필터 (DB에 ['ko', 'en'] 형태로 저장된다고 가정)
    if (selectedLanguage !== '전체') {
      const langMap:Record<string, string> = { '한국어': 'ko', '영어': 'en', '일본어': 'ja', '중국어': 'zh' };
      const langCode = langMap[selectedLanguage] || selectedLanguage;
      
      result = result.filter((item) => 
        item.languages && Array.isArray(item.languages) && item.languages.includes(langCode)
      );
    }

    // 🟢 C. 날짜 필터 (DB에 available_dates 배열이 있다고 가정)
    if (dateRange.start) {
      const selectedStart = new Date(dateRange.start).setHours(0,0,0,0);
      const selectedEnd = dateRange.end ? new Date(dateRange.end).setHours(23,59,59,999) : new Date(dateRange.start).setHours(23,59,59,999);

      result = result.filter((item) => {
        // available_dates 필드가 없거나 비어있으면 검색 결과에서 제외 (혹은 모든 날짜 가능으로 칠지 결정 필요)
        if (!item.available_dates || !Array.isArray(item.available_dates)) return false;

        // 체험 가능 날짜 중 하나라도 선택한 기간에 포함되는지 확인
        return item.available_dates.some((dateStr: string) => {
          const itemDate = new Date(dateStr).getTime();
          return itemDate >= selectedStart && itemDate <= selectedEnd;
        });
      });
    }

    // D. 카테고리 탭 필터 (selectedCategory)
    // 탭으로 선택한 카테고리는 검색어와 별도로 항상 적용 (단, 'all'이 아닐 때)
    if (selectedCategory !== 'all') {
       // 카테고리 ID가 지역명과 일치하면 지역 필터링, 아니면 카테고리 필터링
       // (현재 CATEGORIES 상수 구조상 지역 위주이므로 location 체크)
       result = result.filter((item) => 
          item.location?.includes(selectedCategory) || item.title?.includes(selectedCategory)
       );
    }

    setFilteredExperiences(result);
  };

  // 카테고리 탭 변경 시에는 즉시 필터링
  useEffect(() => {
    // 🔴 중요: locationInput이 비어있을 때만 카테고리 탭 필터링을 단독 수행.
    // 검색어가 있으면 검색 버튼 누를 때까지 기다려야 하므로 여기서는 selectedCategory만 반영.
    // 하지만 "도쿄" 탭을 누르면 바로 도쿄 리스트가 뜨는 건 자연스러우므로 유지.
    if (!locationInput) {
        applyFilters(); 
    }
  }, [selectedCategory]); 

  // 🟢 검색 버튼 핸들러
  const handleSearch = () => {
    applyFilters();
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans relative">
      
      <HomeHero 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedCategory={selectedCategory}
        setSelectedCategory={(id) => {
            setSelectedCategory(id);
            // 탭을 눌렀을 때는 검색창 비우기 (혼동 방지)
            if (id !== 'all') {
                setLocationInput(''); 
            }
        }}
        isScrolled={isScrolled}
        activeSearchField={activeSearchField}
        setActiveSearchField={setActiveSearchField}
        locationInput={locationInput}
        setLocationInput={setLocationInput}
        dateRange={dateRange}
        setDateRange={setDateRange}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
        searchRef={searchRef}
        onSearch={handleSearch} // 검색 버튼 클릭 시 실행
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
              <button 
                onClick={() => { 
                    setLocationInput(''); 
                    setSelectedLanguage('전체'); 
                    setDateRange({ start: null, end: null });
                    setSelectedCategory('all');
                    setFilteredExperiences(allExperiences); 
                }} 
                className="mt-6 px-6 py-3 bg-slate-100 text-slate-900 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                전체 목록 보기
              </button>
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

      <SiteFooter />
    </div>
  );
}