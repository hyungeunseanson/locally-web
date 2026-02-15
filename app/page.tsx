'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Ghost } from 'lucide-react';
import HomeHero from '@/app/components/HomeHero'; 
import ExperienceCard from '@/app/components/ExperienceCard';
import ServiceCard from '@/app/components/ServiceCard';
import { LOCALLY_SERVICES } from '@/app/constants'; 
import { useExperienceFilter } from '@/app/hooks/useExperienceFilter';
import { ExperienceCardSkeleton } from '@/app/components/skeletons/ExperienceCardSkeleton';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'experience' | 'service'>('experience');
  const [activeSearchField, setActiveSearchField] = useState<'location' | 'date' | 'language' | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);

  const {
    loading, filteredExperiences, allExperiences,
    locationInput, setLocationInput,
    selectedCategory, setSelectedCategory,
    selectedLanguage, setSelectedLanguage,
    dateRange, setDateRange,
    setFilteredExperiences,
    applyFilters
  } = useExperienceFilter();

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
        }}
        isScrolled={scrollY > 50}
        activeSearchField={activeSearchField}
        setActiveSearchField={setActiveSearchField}
        locationInput={locationInput}
        setLocationInput={setLocationInput}
        dateRange={dateRange}
        setDateRange={setDateRange}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
        searchRef={searchRef}
        onSearch={applyFilters}
      />

      <main className="max-w-[1760px] mx-auto px-6 md:px-12 py-8 min-h-screen">
        {activeTab === 'experience' && (
          loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-6 gap-y-10">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <ExperienceCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredExperiences.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-40 text-center">
              <Ghost size={48} className="text-slate-300 mb-4"/>
              <h3 className="text-lg font-bold text-slate-900 mb-2">검색 결과가 없습니다.</h3>
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
              {filteredExperiences.map((item) => (
                // 🟢 [수정 완료] 이제 data={item}으로 정확히 전달합니다.
                <ExperienceCard key={item.id} data={item} />
              ))}
            </div>
          )
        )}

        {activeTab === 'service' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
            {LOCALLY_SERVICES.map((item) => <ServiceCard key={item.id} item={item} />)}
          </div>
        )}
      </main>
    </div>
  );
}