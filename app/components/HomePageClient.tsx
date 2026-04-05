'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Ghost } from 'lucide-react';
import Link from 'next/link';
import HomeCategoryIcon from '@/app/components/HomeCategoryIcon';
import HomeHero from '@/app/components/HomeHero';
import HomeExperienceCard, { type HomeExperienceCardData } from '@/app/components/HomeExperienceCard';
import ServiceCard from '@/app/components/ServiceCard';
import { HOME_MOBILE_CITY_SHORTCUTS, LOCALLY_SERVICES } from '@/app/constants';
import { useExperienceFilter } from '@/app/hooks/useExperienceFilter';
import { HomeExperienceCardSkeleton } from '@/app/components/skeletons/HomeExperienceCardSkeleton';
import { useLanguage } from '@/app/context/LanguageContext';
import { useSplash } from '@/app/context/SplashContext';

type HomeExperience = HomeExperienceCardData & {
  created_at?: string | null;
  languages?: string[] | null;
};

export default function HomePageClient() {
  const { t } = useLanguage();
  const { showSplash } = useSplash();

  useEffect(() => {
    showSplash();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

  const searchHref = React.useMemo(() => {
    const params = new URLSearchParams();
    if (locationInput.trim()) params.set('location', locationInput.trim());
    if (selectedLanguage && selectedLanguage !== 'all') params.set('language', selectedLanguage);
    if (dateRange.start) params.set('startDate', dateRange.start.toISOString().slice(0, 10));
    if (dateRange.end) params.set('endDate', dateRange.end.toISOString().slice(0, 10));

    const query = params.toString();
    return query ? `/search?${query}` : '/search';
  }, [dateRange.end, dateRange.start, locationInput, selectedLanguage]);

  const getMobileCityShortcutHref = (cityValue?: string) => {
    if (!cityValue) {
      return '/search';
    }

    const params = new URLSearchParams();
    params.set('location', cityValue);
    params.set('city', cityValue);
    return `/search?${params.toString()}`;
  };

  return (
    <>
    <div className="min-h-screen bg-white md:bg-white text-slate-900 font-sans relative">
      {/* 데스크탑 전용: 검색 필드 포커스 시 배경 딤 처리 */}
      {activeSearchField && (
        <div
          className="hidden md:block fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40 transition-opacity duration-300"
          onClick={() => setActiveSearchField(null)}
        />
      )}
      <div
        className="md:hidden pointer-events-none absolute inset-x-0 top-0 h-[420px] z-0"
        style={{ backgroundImage: 'linear-gradient(180deg, #FAFAFA 0px, #FFFFFF 210px, #FFFFFF 420px)' }}
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
        <div className="md:hidden h-[18px] w-full bg-gradient-to-b from-[#F7F7F7] via-[#FFFFFF] to-transparent" />
        <div className="md:hidden px-5 pt-[7px] pb-0.5">
          <div className="w-full h-[46px] rounded-[13px] border border-slate-200 bg-white flex items-center justify-center text-[10px] font-medium text-slate-700">
            <Link
              href="/about"
              data-testid="home-mobile-about-link"
              className="flex items-center justify-center px-0.5 h-full active:scale-[0.99] transition-transform"
            >
              <span className="font-semibold underline underline-offset-[2px] decoration-[0.8px]">{t('home_mobile_about_link')}</span>
            </Link>
            <span className="font-normal mx-[3px]">{t('home_mobile_links_joiner')}</span>
            <Link
              href="/become-a-host"
              data-testid="home-mobile-host-link"
              className="flex items-center justify-center px-0.5 h-full active:scale-[0.99] transition-transform"
            >
              <span className="font-semibold underline underline-offset-[2px] decoration-[0.8px]">{t('home_mobile_host_support_link')}</span>
            </Link>
          </div>
        </div>

        <div className="px-5 pb-3 pt-3 md:px-0 md:pb-6 md:pt-0">
          {activeTab === 'experience' ? (
            <>
              <div className="md:hidden -mx-5 overflow-x-auto px-5 no-scrollbar" data-testid="home-mobile-city-shortcuts">
                <div className="flex items-center gap-7 border-b border-slate-100 pb-2 pr-4">
                  {HOME_MOBILE_CITY_SHORTCUTS.map((shortcut) => (
                    <Link
                      key={shortcut.id}
                      href={getMobileCityShortcutHref(shortcut.cityValue)}
                      data-testid={`home-mobile-city-shortcut-${shortcut.id}`}
                      aria-current={shortcut.id === 'all' ? 'page' : undefined}
                      className={
                        shortcut.id === 'all'
                          ? 'flex min-w-fit shrink-0 flex-col items-center gap-2 border-b-2 border-black pb-2 text-center text-slate-900 transition-transform active:scale-[0.97]'
                          : 'flex min-w-fit shrink-0 flex-col items-center gap-2 border-b-2 border-transparent pb-2 text-center text-slate-500 transition-transform active:scale-[0.97]'
                      }
                    >
                      {shortcut.visual === 'emoji' ? (
                        <>
                          <span className="flex h-[32px] items-center justify-center text-2xl leading-none">
                            {shortcut.emoji}
                          </span>
                          <span className={`text-xs font-bold leading-tight whitespace-nowrap ${shortcut.id === 'all' ? 'text-black' : 'text-slate-600'}`}>
                            {t(shortcut.label)}
                          </span>
                        </>
                      ) : (
                        <>
                          <span
                            data-testid={`home-mobile-city-shortcut-${shortcut.id}-visual`}
                            className="flex h-[32px] items-center justify-center"
                          >
                            <HomeCategoryIcon id={shortcut.id} />
                          </span>
                          <span className="text-xs font-bold leading-tight whitespace-nowrap text-slate-600">{t(shortcut.label)}</span>
                        </>
                      )}
                    </Link>
                  ))}
                </div>
              </div>

              <div
                data-testid="home-experience-ingress-hint"
                className="hidden rounded-[18px] border border-slate-200 bg-white/95 px-4 py-3 text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.05)] md:mx-auto md:flex md:max-w-[1100px] md:items-center md:justify-between md:gap-4 md:rounded-[20px] md:bg-white/90 md:px-5"
              >
                <div className="md:max-w-[620px]">
                  <p className="text-[12px] font-semibold tracking-[-0.01em] md:text-[14px]">
                    {t('home_exp_ingress_title')}
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500 md:text-[13px]">
                    {t('home_exp_ingress_desc')}
                  </p>
                </div>
                <div className="mt-3 flex flex-col gap-2 md:mt-0 md:flex-row md:items-center md:justify-end md:gap-2.5">
                  <Link
                    href={searchHref}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-slate-300 px-4 text-[12px] font-semibold text-slate-900 transition-colors hover:bg-slate-50 md:shrink-0"
                  >
                    {t('home_exp_ingress_cta')}
                  </Link>
                  <Link
                    href="/about"
                    data-testid="home-experience-about-link"
                    className="hidden h-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 md:inline-flex md:shrink-0"
                  >
                    {t('footer_intro')}
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <div
              data-testid="home-service-ingress-hint"
              className="rounded-[18px] border border-[#E8D7BD] bg-[#FFF8EE] px-4 py-3 text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.04)] md:flex md:items-center md:justify-between md:gap-5 md:rounded-[20px] md:px-5"
            >
              <div>
                <p className="text-[12px] font-semibold tracking-[-0.01em] md:text-[14px]">
                  {t('home_service_ingress_title')}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-slate-600 md:text-[13px]">
                  {t('home_service_ingress_desc')}
                </p>
              </div>
              <Link
                href="/services/request"
                className="mt-3 inline-flex h-10 items-center justify-center rounded-full border border-[#D9B77E] bg-white px-4 text-[12px] font-semibold text-slate-900 transition-colors hover:bg-[#FFF4E3] md:mt-0 md:shrink-0"
              >
                {t('home_service_ingress_cta')}
              </Link>
            </div>
          )}
        </div>

        {activeTab === 'experience' && (
          loading ? (
            <>
              {/* 모바일 스켈레톤? */}
              <div className="md:hidden px-5 pb-6">
                <div className="flex gap-3 overflow-x-auto no-scrollbar">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="min-w-[42vw] max-w-[42vw] shrink-0">
                      <HomeExperienceCardSkeleton />
                    </div>
                  ))}
                </div>
              </div>
              {/* 데스크탑 스켈레톤 */}
              <div className="hidden md:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-6 gap-y-10">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <HomeExperienceCardSkeleton key={i} />
                ))}
              </div>
            </>
          ) : filteredExperiences.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-40 text-center px-5">
              <Ghost size={48} className="text-slate-300 mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-2">{t('home_empty_title')}</h3>
              <p className="text-slate-500 text-sm mb-2">{t('home_empty_desc')}</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => {
                    setLocationInput('');
                    setSelectedLanguage('all');
                    setDateRange({ start: null, end: null });
                    setSelectedCategory('all');
                    setFilteredExperiences(allExperiences);
                  }}
                  className="px-6 py-3 bg-slate-100 text-slate-900 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  {t('home_empty_reset')}
                </button>
                <Link
                  href="/search"
                  className="px-6 py-3 rounded-xl border border-slate-300 text-slate-900 font-bold hover:bg-slate-50 transition-colors"
                >
                  {t('home_empty_browse')}
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* 📱 모바일: 에어비앤비 다중 섹션 레이아웃 */}
              <div className="md:hidden pb-4">
                {/* 섹션 렌더 헬퍼 */}
                {(() => {
                  const list = filteredExperiences as HomeExperience[];

                  // 섹션별 체험 분류
                  const popular = list.slice(0, 10);
                  const newest = [...list].sort((a, b) =>
                    new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
                  ).slice(0, 10);
                  const koreanExp = list.filter((e) => e.languages?.includes('한국어')).slice(0, 10);
                  const japaneseExp = list.filter((e) => e.languages?.includes('일본어')).slice(0, 10);
                  const englishExp = list.filter((e) => e.languages?.includes('영어')).slice(0, 10);
                  const chineseExp = list.filter((e) => e.languages?.includes('중국어')).slice(0, 10);

                  // 언어별 섹션 (사용자 언어에 따라 순서 변경)
                  const langSections: { title: string; data: HomeExperience[] }[] = [];
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
                    <button className="w-[36px] h-[36px] rounded-full flex items-center justify-center shrink-0"
                      style={{ border: '0.5px solid #B0B0B0' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                    </button>
                  );

                  return allSections.map((section, idx) => (
                    <div key={idx}>
                      {idx > 0 && <div className="h-[12px] w-full mb-1 bg-gradient-to-b from-[#E5E5E5] via-[#EFEFEF] to-transparent" />}
                      <div className="flex items-center justify-between px-5 pt-3 pb-2">
                        <h2 className="text-[17px] font-semibold text-[#222222] tracking-[-0.02em] leading-tight">{section.title}</h2>
                        <SectionArrow />
                      </div>
                      <div className="flex gap-[10px] overflow-x-auto no-scrollbar px-5 pb-5">
                        {section.data.map((item) => (
                          <div key={item.id} className="min-w-[42vw] max-w-[42vw] shrink-0">
                            <HomeExperienceCard data={item} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>

              {/* 🖥️ 데스크탑: 기존 그리드 */}
              <div className="hidden md:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-6 gap-y-10">
                {(filteredExperiences as HomeExperience[]).map((item, index) => (
                  <div key={item.id} className="animate-in fade-in duration-500" style={{ animationDelay: `${Math.min(index * 60, 600)}ms`, animationFillMode: 'both' }}>
                    <HomeExperienceCard data={item} />
                  </div>
                ))}
              </div>
            </>
          )
        )}

        {activeTab === 'service' && (
          <>
            {/* 📱 모바일 서비스 */}
            <div className="md:hidden pb-4">
              <div className="flex items-center justify-between px-5 pt-3 pb-2">
                <h2 className="text-[17px] font-semibold text-[#222222] tracking-[-0.02em] leading-tight">{t('home_section_popular_services')}</h2>
              </div>
              <div className="flex gap-[10px] overflow-x-auto no-scrollbar px-5 pb-5">
                {LOCALLY_SERVICES.map((item) => (
                  <div key={item.id} className="min-w-[42vw] max-w-[42vw] shrink-0">
                    {item.href ? (
                      <Link href={item.href}><ServiceCard item={item} /></Link>
                    ) : (
                      <ServiceCard item={item} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 🖥️ 데스크탑 서비스 */}
            <div className="hidden md:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-6 gap-y-10">
              {LOCALLY_SERVICES.map((item) => (
                item.href ? (
                  <Link key={item.id} href={item.href}><ServiceCard item={item} /></Link>
                ) : (
                  <ServiceCard key={item.id} item={item} />
                )
              ))}
            </div>
          </>
        )}
      </main>
    </div>
    </>
  );
}
