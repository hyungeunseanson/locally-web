'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Ghost } from 'lucide-react';
import Link from 'next/link';
import HomeHero from '@/app/components/HomeHero';
import ExperienceCard from '@/app/components/ExperienceCard';
import ServiceCard from '@/app/components/ServiceCard';
import { LOCALLY_SERVICES } from '@/app/constants';
import { useExperienceFilter } from '@/app/hooks/useExperienceFilter';
import { ExperienceCardSkeleton } from '@/app/components/skeletons/ExperienceCardSkeleton';
import { useLanguage } from '@/app/context/LanguageContext';

export default function HomePageClient() {
  const { t } = useLanguage();
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
    <div className="min-h-screen bg-[#F3F3F3] md:bg-white text-slate-900 font-sans relative">
      <div
        className="md:hidden pointer-events-none absolute inset-x-0 top-0 h-[420px] z-0"
        style={{ backgroundImage: 'linear-gradient(180deg, #E6E6E6 0px, #EEEEEE 210px, #F3F3F3 420px)' }}
      />
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

      <main className="max-w-[1760px] mx-auto px-0 md:px-12 py-0 md:py-8 min-h-screen relative z-[1]">
        <div className="md:hidden h-[24px] w-full bg-gradient-to-b from-[#E5E5E5] via-[#EFEFEF] to-transparent" />
        <div className="md:hidden px-5 pt-3 pb-2">
          <div className="relative overflow-hidden rounded-[18px] border border-white/70 bg-[radial-gradient(circle_at_20%_0%,#fff9e8_0%,#f5f7ff_40%,#eef2ff_100%)] p-3 shadow-[0_10px_20px_rgba(16,24,40,0.12),_inset_0_1px_0_rgba(255,255,255,0.8)]">
            <div className="pointer-events-none absolute -top-6 -right-8 h-20 w-20 rounded-full bg-[radial-gradient(circle,#ffe9b3_0%,rgba(255,233,179,0)_70%)] opacity-80" />
            <div className="pointer-events-none absolute -bottom-8 -left-6 h-24 w-24 rounded-full bg-[radial-gradient(circle,#cfe3ff_0%,rgba(207,227,255,0)_70%)] opacity-80" />
            <div className="relative grid grid-cols-2 gap-2">
              <Link
                href="/about"
                className="h-[48px] rounded-[14px] border border-white/80 bg-[linear-gradient(180deg,#ffffff_0%,#f3f6ff_100%)] shadow-[0_6px_12px_rgba(30,41,59,0.12),_inset_0_1px_0_rgba(255,255,255,0.9)] text-[11px] font-semibold text-[#1E293B] transition-transform active:translate-y-[1px]"
              >
                <span className="flex h-full items-center justify-center gap-1">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#FFE8B5] text-[10px]">L</span>
                  로컬리 소개
                </span>
              </Link>
              <Link
                href="/become-a-host"
                className="h-[48px] rounded-[14px] border border-white/80 bg-[linear-gradient(180deg,#ffffff_0%,#f0fff7_100%)] shadow-[0_6px_12px_rgba(15,23,42,0.12),_inset_0_1px_0_rgba(255,255,255,0.9)] text-[11px] font-semibold text-[#0F172A] transition-transform active:translate-y-[1px]"
              >
                <span className="flex h-full items-center justify-center gap-1">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#C8F2D6] text-[10px]">H</span>
                  호스트 지원
                </span>
              </Link>
            </div>
          </div>
        </div>

        {activeTab === 'experience' && (
          loading ? (
            <>
              {/* 모바일 스켈레톤? */}
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
              {/* 📱 모바일: 에어비앤비 다중 섹션 레이아웃 */}
              <div className="md:hidden pb-4">
                {/* 섹션 렌더 헬퍼 */}
                {(() => {
                  // 섹션별 체험 분류
                  const popular = filteredExperiences.slice(0, 10);
                  const newest = [...filteredExperiences].sort((a: any, b: any) =>
                    new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
                  ).slice(0, 10);
                  const koreanExp = filteredExperiences.filter((e: any) => e.languages?.includes('한국어')).slice(0, 10);
                  const japaneseExp = filteredExperiences.filter((e: any) => e.languages?.includes('일본어')).slice(0, 10);
                  const englishExp = filteredExperiences.filter((e: any) => e.languages?.includes('영어')).slice(0, 10);
                  const chineseExp = filteredExperiences.filter((e: any) => e.languages?.includes('중국어')).slice(0, 10);

                  // 언어별 섹션 (사용자 언어에 따라 순서 변경)
                  const langSections: { title: string; data: any[] }[] = [];
                  if (koreanExp.length > 0) langSections.push({ title: t('home_section_lang_ko'), data: koreanExp });
                  if (japaneseExp.length > 0) langSections.push({ title: t('home_section_lang_ja'), data: japaneseExp });
                  if (englishExp.length > 0) langSections.push({ title: t('home_section_lang_en'), data: englishExp });
                  if (chineseExp.length > 0) langSections.push({ title: t('home_section_lang_zh'), data: chineseExp });

                  const allSections = [
                    { title: t('home_section_popular_experiences'), data: popular },
                    { title: t('home_section_new_experiences'), data: newest },
                    ...langSections,
                  ].filter(s => s.data.length > 0);

                  const SectionArrow = () => (
                    <button className="w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0"
                      style={{ border: '0.5px solid #B0B0B0' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                    </button>
                  );

                  return allSections.map((section, idx) => (
                    <div key={idx}>
                      {idx > 0 && <div className="h-[12px] w-full mb-1 bg-gradient-to-b from-[#E5E5E5] via-[#EFEFEF] to-transparent" />}
                      <div className="flex items-center justify-between px-5 pt-4 pb-3">
                        <h2 className="text-[15px] font-semibold text-[#222222] tracking-[-0.02em] leading-tight">{section.title}</h2>
                        <SectionArrow />
                      </div>
                      <div className="flex gap-[10px] overflow-x-auto no-scrollbar px-5 pb-5">
                        {section.data.map((item: any) => (
                          <div key={item.id} className="min-w-[42vw] max-w-[42vw] shrink-0">
                            <ExperienceCard data={item} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
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
            <div className="md:hidden pb-4">
              <div className="h-[12px] w-full mb-1 bg-gradient-to-b from-[#E5E5E5] via-[#EFEFEF] to-transparent" />
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <h2 className="text-[15px] font-semibold text-[#222222] tracking-[-0.02em] leading-tight">{t('home_section_popular_services')}</h2>
                <button
                  className="w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0"
                  style={{ border: '0.5px solid #B0B0B0' }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              </div>
              <div className="flex gap-[10px] overflow-x-auto no-scrollbar px-5 pb-5">
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
