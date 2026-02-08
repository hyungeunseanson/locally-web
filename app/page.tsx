'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Globe, Ghost } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client';
import HomeHero from '@/app/components/HomeHero'; 
import ExperienceCard from '@/app/components/ExperienceCard';
import ServiceCard from '@/app/components/ServiceCard';
import { LOCALLY_SERVICES } from '@/app/constants';
import SiteFooter from '@/app/components/SiteFooter'; // 푸터 추가

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'experience' | 'service'>('experience');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const [allExperiences, setAllExperiences] = useState<any[]>([]); // 전체 데이터 원본
  const [filteredExperiences, setFilteredExperiences] = useState<any[]>([]); // 필터링된 결과
  const [loading, setLoading] = useState(true);
  
  // 검색창 상태
  const [activeSearchField, setActiveSearchField] = useState<'location' | 'date' | 'language' | null>(null);
  const [locationInput, setLocationInput] = useState('');
  const [dateRange, setDateRange] = useState<{start: Date | null, end: Date | null}>({ start: null, end: null });
  const [selectedLanguage, setSelectedLanguage] = useState('전체'); // 'all' 대신 '전체' 사용 (UI 통일)
  
  const [scrollY, setScrollY] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  
  const supabase = createClient();

  // 스크롤 감지 및 외부 클릭 처리 (기존 유지)
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

  // 🟢 1. 초기 데이터 로드 (전체 목록 가져오기)
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
          setFilteredExperiences(data); // 초기엔 전체 표시
        }
      } catch (error) { console.error(error); } 
      finally { setLoading(false); }
    };
    fetchExperiences();
  }, []);

  // 🟢 2. 통합 필터링 함수 (검색 버튼 클릭 or 카테고리 변경 시 실행)
  const applyFilters = () => {
    let result = allExperiences;

    // A. 지역/키워드 필터 (locationInput)
    if (locationInput.trim()) {
      const term = locationInput.toLowerCase();
      result = result.filter((item) => 
        (item.title && item.title.toLowerCase().includes(term)) ||
        (item.location && item.location.toLowerCase().includes(term)) ||
        (item.description && item.description.toLowerCase().includes(term))
      );
    }

    // B. 언어 필터
    if (selectedLanguage !== '전체') {
      // 언어 코드 매핑 (UI용 한글 -> DB 저장용 코드)
      // DB에 'ko', 'en' 등으로 저장되어 있다고 가정. 만약 한글 그대로 저장되어 있다면 매핑 불필요.
      const langMap:Record<string, string> = { '한국어': 'ko', '영어': 'en', '일본어': 'ja', '중국어': 'zh' };
      const langCode = langMap[selectedLanguage] || selectedLanguage;
      
      result = result.filter((item) => 
        item.languages && Array.isArray(item.languages) && item.languages.includes(langCode)
      );
    }

    // C. 카테고리 탭 필터 (selectedCategory)
    // 'all'이 아니고, 검색창 입력값과 다를 경우에만 추가 필터링 (지역 카테고리인 경우)
    if (selectedCategory !== 'all') {
       // locationInput이 비어있거나, 입력값과 선택된 카테고리가 다를 때만 카테고리로 한 번 더 거름
       // (보통 지역 카테고리 선택 시 locationInput에 자동 입력되므로 중복 필터링 방지)
       if (!locationInput || !locationInput.includes(CATEGORIES.find(c=>c.id===selectedCategory)?.label || '')) {
          result = result.filter((item) => 
            item.location?.includes(selectedCategory) || item.title?.includes(selectedCategory)
          );
       }
    }

    // D. 날짜 필터 (추후 구현: availability 테이블 연동 필요)
    // 현재는 날짜 선택 시 해당 기간에 가능한 체험만 보여주는 로직이 복잡하므로 생략하거나, 
    // 메타데이터에 날짜 정보가 있다면 여기서 필터링.

    setFilteredExperiences(result);
  };

  // 카테고리 변경 시 필터링 적용
  useEffect(() => {
    applyFilters();
  }, [selectedCategory]); 

  // 검색 버튼 핸들러 (버튼 클릭 시 필터링 적용)
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
            // 카테고리 선택 시 검색창 텍스트도 해당 지역명으로 업데이트 (선택 사항)
            const categoryLabel = CATEGORIES.find(c => c.id === id)?.label;
            if (categoryLabel && id !== 'all') {
                setLocationInput(categoryLabel);
            } else if (id === 'all') {
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
        onSearch={handleSearch} // 🟢 검색 핸들러 전달
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