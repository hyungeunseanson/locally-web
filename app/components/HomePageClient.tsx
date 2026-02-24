'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Ghost } from 'lucide-react';
import HomeHero from '@/app/components/HomeHero';
import ExperienceCard from '@/app/components/ExperienceCard';
import ServiceCard from '@/app/components/ServiceCard';
import { LOCALLY_SERVICES } from '@/app/constants';
import { useExperienceFilter } from '@/app/hooks/useExperienceFilter';
import { ExperienceCardSkeleton } from '@/app/components/skeletons/ExperienceCardSkeleton';

export default function HomePageClient() {
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

      <main className="max-w-[1760px] mx-auto px-0 md:px-12 py-0 md:py-8 min-h-screen">
        {activeTab === 'experience' && (
          loading ? (
            <>
              {/* 모바일 스켈레톤 */}
              <div className="md:hidden px-5 pb-6">
                <div className="flex gap-3 overflow-x-auto no-scrollbar">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="min-w-[43vw] shrink-0 animate-pulse">
                      <div className="bg-slate-100 aspect-square rounded-xl mb-2"></div>
                      <div className="h-3 bg-slate-100 rounded w-3/4 mb-1.5"></div>
                      <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              </div>
              {/* 데스크탑 스켈레톤 */}
              <div className="hidden md:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-6 gap-y-10">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <ExperienceCardSkeleton key={i} />
                ))}
              </div>
            </>
          ) : filteredExperiences.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-40 text-center px-5">
              <Ghost size={48} className="text-slate-300 mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-2">이 조건에 맞는 체험이 없어요</h3>
              <p className="text-slate-500 text-sm mb-2">날짜나 지역을 바꿔보거나, 아래 버튼으로 전체 목록을 둘러보세요.</p>
              <button
                onClick={() => {
                  setLocationInput('');
                  setSelectedLanguage('all');
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
            <>
              {/* 📱 모바일: 에어비앤비 정확한 섹션 레이아웃 */}
              <div className="md:hidden pb-28">
                {/* 섹션 헤더 — 에어비앤비 정확한 스타일 */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4">
                  <h2 className="text-[22px] font-extrabold text-[#222222] tracking-[-0.02em] leading-tight">인기 체험</h2>
                  <button
                    className="w-[28px] h-[28px] rounded-full flex items-center justify-center shrink-0"
                    style={{ border: '0.5px solid #B0B0B0' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                  </button>
                </div>

                {/* 가로 스크롤 카드 — 에어비앤비 42% 너비 */}
                <div className="flex gap-[10px] overflow-x-auto no-scrollbar px-6 pb-8">
                  {filteredExperiences.map((item: any) => (
                    <div key={item.id} className="min-w-[42vw] max-w-[42vw] shrink-0">
                      <ExperienceCard data={item} />
                    </div>
                  ))}
                </div>
              </div>

              {/* 🖥️ 데스크탑: 기존 그리드 */}
              <div className="hidden md:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-6 gap-y-10">
                {filteredExperiences.map((item: any) => (
                  <ExperienceCard key={item.id} data={item} />
                ))}
              </div>
            </>
          )
        )}

        {activeTab === 'service' && (
          <>
            {/* 📱 모바일 서비스 */}
            <div className="md:hidden pb-28">
              <div className="flex items-center justify-between px-6 pt-6 pb-4">
                <h2 className="text-[22px] font-extrabold text-[#222222] tracking-[-0.02em] leading-tight">인기 서비스</h2>
                <button
                  className="w-[28px] h-[28px] rounded-full flex items-center justify-center shrink-0"
                  style={{ border: '0.5px solid #B0B0B0' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              </div>
              <div className="flex gap-[10px] overflow-x-auto no-scrollbar px-6 pb-8">
                {LOCALLY_SERVICES.map((item) => (
                  <div key={item.id} className="min-w-[42vw] max-w-[42vw] shrink-0">
                    <ServiceCard item={item} />
                  </div>
                ))}
              </div>
            </div>

            {/* 🖥️ 데스크탑 서비스 */}
            <div className="hidden md:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
              {LOCALLY_SERVICES.map((item) => (
                <ServiceCard key={item.id} item={item} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
