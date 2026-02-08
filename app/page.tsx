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

  // 스크롤 및 외부 클릭 처리
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

  // 🟢 2. 강력해진 통합 필터링 함수
  const applyFilters = () => {
    let result = allExperiences;

    // A. 지역/키워드 필터 (띄어쓰기 단위로 쪼개서 AND 조건 검색)
    // 예: "도쿄 액티비티" -> "도쿄"도 있고 "액티비티"도 있는 항목 검색
    if (locationInput.trim()) {
      // 1. 특수문자(· 등)를 공백으로 치환하고, 공백 기준으로 단어 쪼개기
      const searchTerms = locationInput
        .replace(/[·,.]/g, ' ') // "도쿄 · 액티비티" -> "도쿄   액티비티"
        .toLowerCase()
        .split(/\s+/) // 공백 기준으로 배열 생성 ['도쿄', '액티비티']
        .filter(term => term.length > 0); // 빈 문자열 제거

      result = result.filter((item) => {
        // 검색 대상 필드들을 하나의 문자열로 합침
        const targetString = `
          ${item.title || ''} 
          ${item.location || ''} 
          ${item.description || ''} 
          ${item.category || ''}
          ${Array.isArray(item.tags) ? item.tags.join(' ') : ''} 
        `.toLowerCase();
        
        // 모든 검색어가 targetString에 포함되어야 함 (AND 조건)
        return searchTerms.every(term => targetString.includes(term));
      });
    }

    // B. 언어 필터 (DB에 한글('한국어')로 저장됐든 코드('ko')로 저장됐든 다 찾음)
    if (selectedLanguage !== '전체') {
      const langMap:Record<string, string> = { '한국어': 'ko', '영어': 'en', '일본어': 'ja', '중국어': 'zh' };
      const langCode = langMap[selectedLanguage]; // 'ko'
      
      result = result.filter((item) => {
        if (!item.languages || !Array.isArray(item.languages)) return false;
        // 배열 안에 '한국어'가 있거나 'ko'가 있으면 통과
        return item.languages.includes(selectedLanguage) || (langCode && item.languages.includes(langCode));
      });
    }

    // C. 날짜 필터 (날짜만 선택해도 검색되도록 로직 수정)
    if (dateRange.start) {
      const selectedStart = new Date(dateRange.start);
      selectedStart.setHours(0,0,0,0); // 시간 제거

      const selectedEnd = dateRange.end ? new Date(dateRange.end) : new Date(dateRange.start);
      selectedEnd.setHours(23,59,59,999);

      result = result.filter((item) => {
        // available_dates 필드가 없으면(null) -> 일단 검색되게 할지 제외할지 결정 (여기선 날짜 정보 없으면 검색 제외)
        if (!item.available_dates || !Array.isArray(item.available_dates) || item.available_dates.length === 0) {
            // 데이터가 없으면 날짜 필터 시 제외하는 게 맞음
            return false; 
        }

        // 체험 가능 날짜 중 하나라도 선택한 기간에 포함되는지 확인
        return item.available_dates.some((dateStr: string) => {
          const itemDate = new Date(dateStr);
          itemDate.setHours(0,0,0,0);
          return itemDate.getTime() >= selectedStart.getTime() && itemDate.getTime() <= selectedEnd.getTime();
        });
      });
    }

    // D. 카테고리 탭 필터 (selectedCategory)
    if (selectedCategory !== 'all') {
       // 검색창에 입력된 값이 없을 때만 탭 필터 적용 (검색창이 우선)
       // 또는 검색창 입력값과 카테고리가 충돌하지 않도록 보조
       if (!locationInput) {
          result = result.filter((item) => 
            item.location?.includes(selectedCategory) || item.title?.includes(selectedCategory)
          );
       }
    }

    setFilteredExperiences(result);
  };

  // 카테고리 탭 변경 시 즉시 필터링
  useEffect(() => {
    // 탭을 눌렀을 땐 검색창을 비우고 탭 기준 필터링
    if (selectedCategory !== 'all') {
        // setLocationInput(''); // 필요시 주석 해제 (탭 누르면 검색어 초기화)
        applyFilters(); 
    } else {
        // 전체 탭 누르면 전체 보기
        applyFilters();
    }
  }, [selectedCategory]); 

  // 🟢 검색 버튼 핸들러 (버튼 클릭 시에만 검색 실행)
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
            // 탭 누를 때 검색창 값 초기화 (혼선 방지)
            if (id === 'all') {
                setLocationInput('');
                setFilteredExperiences(allExperiences);
            } else {
                // 탭에 해당하는 지역명을 검색창에 넣지 않고, 그냥 필터만 적용하려면 아래 줄 제거
                const label = CATEGORIES.find(c => c.id === id)?.label;
                if(label) setLocationInput(label);
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
        onSearch={handleSearch} // 검색 버튼 클릭 시 applyFilters 실행
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
              <p className="text-slate-500 text-sm">다른 키워드, 날짜, 언어로 검색해보세요!</p>
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