'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Globe, Ghost } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client';
import HomeHero from '@/app/components/HomeHero'; 
import ExperienceCard from '@/app/components/ExperienceCard';
import ServiceCard from '@/app/components/ServiceCard';
// 🚨 수정된 부분: CATEGORIES 추가됨 (이게 없어서 에러 남)
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

  // 2. 통합 필터링 함수
  const applyFilters = () => {
    let result = allExperiences;

    // A. 지역/키워드 필터
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
      const langMap:Record<string, string> = { '한국어': 'ko', '영어': 'en', '일본어': 'ja', '중국어': 'zh' };
      const langCode = langMap[selectedLanguage] || selectedLanguage;
      
      result = result.filter((item) => 
        item.languages && Array.isArray(item.languages) && item.languages.includes(langCode)
      );
    }

    // C. 카테고리 탭 필터 (에러 났던 부분: CATEGORIES가 이제 import 되어 정상 작동)
    if (selectedCategory !== 'all') {
       if (!locationInput || !locationInput.includes(CATEGORIES.find(c=>c.id===selectedCategory)?.label || '')) {
          result = result.filter((item) => 
            item.location?.includes(selectedCategory) || item.title?.includes(selectedCategory)
          );
       }
    }

    setFilteredExperiences(result);
  };

  // 카테고리 변경 시 필터링
  useEffect(() => {
    applyFilters();
  }, [selectedCategory]); 

  // 검색 버튼 클릭 시 필터링
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