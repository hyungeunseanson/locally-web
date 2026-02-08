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

  // 🟢 1. 데이터 로드 (체험 + 예약 가능 날짜 함께 가져오기)
  useEffect(() => {
    const fetchExperiences = async () => {
      setLoading(true);
      try {
        // (1) 활성화된 체험 불러오기
        let { data: expData, error } = await supabase
          .from('experiences')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (expData && expData.length > 0) {
          // (2) 해당 체험들의 예약 가능 날짜 불러오기 (별도 테이블)
          const expIds = expData.map(e => e.id);
          const { data: dateData } = await supabase
            .from('experience_availability')
            .select('experience_id, date')
            .in('experience_id', expIds);

          // (3) 데이터 합치기
          const mergedData = expData.map(exp => ({
            ...exp,
            // 별도 테이블에서 가져온 날짜들을 배열로 추가
            available_dates: dateData
              ?.filter(d => d.experience_id === exp.id)
              .map(d => d.date) || []
          }));

          setAllExperiences(mergedData);
          setFilteredExperiences(mergedData);
        } else {
          setAllExperiences([]);
          setFilteredExperiences([]);
        }
      } catch (error) { console.error(error); } 
      finally { setLoading(false); }
    };
    fetchExperiences();
  }, []);

  // 🟢 2. 통합 필터링 로직 (여기가 핵심!)
  const applyFilters = () => {
    let result = allExperiences;

    // A. 지역/키워드 필터 (item.city 추가!)
    if (locationInput.trim()) {
      const searchTerms = locationInput
        .replace(/[·,.]/g, ' ') 
        .toLowerCase()
        .split(/\s+/)
        .filter(term => term.length > 0);

      result = result.filter((item) => {
        // 🔴 중요: item.city를 검색 대상에 포함 (DB 컬럼명이 city임)
        const targetString = `
          ${item.title || ''} 
          ${item.city || ''} 
          ${item.description || ''} 
          ${item.category || ''}
          ${Array.isArray(item.tags) ? item.tags.join(' ') : ''} 
        `.toLowerCase();
        
        return searchTerms.every(term => targetString.includes(term));
      });
    }

    // B. 언어 필터 (데이터가 없어서 동작 안 할 수 있음 - 안전장치 추가)
    if (selectedLanguage !== '전체') {
      const langMap:Record<string, string> = { '한국어': 'ko', '영어': 'en', '일본어': 'ja', '중국어': 'zh' };
      const langCode = langMap[selectedLanguage] || selectedLanguage;
      
      result = result.filter((item) => {
        // 언어 데이터가 없으면 검색에서 제외 (추후 등록 페이지에 언어 선택 추가 필요)
        if (!item.languages || !Array.isArray(item.languages)) return false;
        return item.languages.includes(selectedLanguage) || item.languages.includes(langCode);
      });
    }

    // C. 날짜 필터 (합쳐진 available_dates 사용)
    if (dateRange.start) {
      const selectedStart = new Date(dateRange.start);
      selectedStart.setHours(0,0,0,0);
      const selectedEnd = dateRange.end ? new Date(dateRange.end) : new Date(dateRange.start);
      selectedEnd.setHours(23,59,59,999);

      result = result.filter((item) => {
        // 날짜 데이터가 없으면 제외
        if (!item.available_dates || item.available_dates.length === 0) return false;

        return item.available_dates.some((dateStr: string) => {
          const itemDate = new Date(dateStr);
          itemDate.setHours(0,0,0,0);
          return itemDate.getTime() >= selectedStart.getTime() && itemDate.getTime() <= selectedEnd.getTime();
        });
      });
    }

    // D. 카테고리 탭 필터 (ID -> Label 변환!)
    if (selectedCategory !== 'all') {
       if (!locationInput) {
          // 🔴 중요: selectedCategory는 ID('seoul')이므로, Label('서울')로 바꿔서 비교
          const categoryLabel = CATEGORIES.find(c => c.id === selectedCategory)?.label;
          
          if (categoryLabel) {
             result = result.filter((item) => 
               item.city === categoryLabel || // item.city('서울') === categoryLabel('서울')
               item.title?.includes(categoryLabel)
             );
          }
       }
    }

    setFilteredExperiences(result);
  };

  // 상태 변경 시 필터 적용
  useEffect(() => {
    if (!locationInput) applyFilters();
  }, [selectedCategory]); 

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
            if (id === 'all') {
                setLocationInput('');
                setFilteredExperiences(allExperiences);
            }
            // 탭 누를 때 검색창 자동 입력은 혼란을 줄 수 있어 제거 (필터만 작동)
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
        onSearch={handleSearch}
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
              <p className="text-slate-500 text-sm">다른 키워드나 조건으로 검색해보세요!</p>
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