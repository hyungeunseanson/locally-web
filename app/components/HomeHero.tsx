'use client';

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader';
import MainSearchBar from '@/app/components/MainSearchBar';
import HomeCategoryIcon from '@/app/components/HomeCategoryIcon';
import MobileSearchModal from '@/app/components/mobile/MobileSearchModal';
import MobileLanguageSwitcher from '@/app/components/mobile/MobileLanguageSwitcher';
import { CATEGORIES } from '@/app/constants';
import { useLanguage } from '@/app/context/LanguageContext';

interface HomeHeroProps {
  dateRange: { start: Date | null; end: Date | null };
  setDateRange: (range: { start: Date | null; end: Date | null }) => void;

  activeTab: 'experience' | 'service';
  setActiveTab: (tab: 'experience' | 'service') => void;
  selectedCategory: string;
  setSelectedCategory: (id: string) => void;
  isScrolled: boolean;

  // ✅ [수정] 'language' 타입 추가
  activeSearchField: 'location' | 'date' | 'language' | null;
  setActiveSearchField: (field: 'location' | 'date' | 'language' | null) => void;

  locationInput: string;
  setLocationInput: (val: string) => void;
  searchRef: React.RefObject<HTMLDivElement | null>;
  onSearch: (locationOverride?: string) => void;

  // ✅ [추가] 부모(HomePage)에서 보내주는 언어 관련 Props도 받아야 함
  selectedLanguage?: string;
  setSelectedLanguage?: (lang: string) => void;
}

export default function HomeHero({

  activeTab, setActiveTab,
  selectedCategory, setSelectedCategory,
  isScrolled,
  activeSearchField, setActiveSearchField,
  locationInput, setLocationInput,
  dateRange, setDateRange,
  searchRef,
  onSearch,

  // 👇 여기 두 줄을 꼭 추가해주세요!
  selectedLanguage,
  setSelectedLanguage
}: HomeHeroProps) {
  const { t } = useLanguage();
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  return (
    <>
      {/* 🟢 1. 상단 고정 헤더 & Sticky 캡슐 검색바 (데스크탑 전용) */}
      <div className={`hidden md:block fixed top-0 left-0 right-0 z-50 bg-white transition-shadow duration-300 ${isScrolled ? 'shadow-sm' : ''} h-20`}>
        <SiteHeader />

        {/* 스크롤 시 나타나는 작은 검색바 */}
        <div
          className={[
            'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
            'flex items-center bg-white border border-slate-300 rounded-full',
            'shadow-sm hover:shadow-md h-12 px-2 cursor-pointer z-[100]',
            'transition-all duration-300 ease-in-out',
            isScrolled ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-75 pointer-events-none',
          ].join(' ')}
          onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setActiveSearchField('location'); }}
        >
          <div className="px-4 text-sm font-bold text-slate-900 border-r border-slate-300">{t('anywhere')}</div>
          <div className="px-4 text-sm font-bold text-slate-900 border-r border-slate-300">{t('anytime')}</div>
          <div className="px-4 text-sm font-bold text-slate-500">{t('search')}</div>
          <button className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center text-white ml-2">
            <Search size={14} strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* 📱 모바일: 에어비앤비 홈화면 */}
      <div className={`md:hidden sticky top-0 z-40 transition-all duration-300 ${isScrolled ? 'pt-[calc(env(safe-area-inset-top,0px)+6px)] pb-0' : 'pt-[calc(env(safe-area-inset-top,0px)+9px)] pb-0'
        }`} style={{
          background: 'linear-gradient(180deg, #F7F7F7 0%, #FCFCFC 48%, #FFFFFF 100%)',
        }}>

        {/* 검색 캡슐 — 스크림 없이 바로 사용, 배경은 부모에서 상속 */}
        <div className="px-5 mb-2 transition-all duration-300 flex items-center gap-2.5">
          <button
            data-testid="home-mobile-search-trigger"
            onClick={() => setIsMobileSearchOpen(true)}
            className="flex-1 h-[56px] flex items-center justify-center gap-2.5 bg-white rounded-[28px] px-6 active:scale-[0.98] transition-transform"
            style={{
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              border: '1px solid rgba(15,23,42,0.06)',
            }}
          >
            <Search size={14} className="text-[#3A3A3A] shrink-0" strokeWidth={2.4} />
            <span className="text-[13px] text-[#3A3A3A] font-medium tracking-[-0.01em]">{t('home_search_cta')}</span>
          </button>
          <MobileLanguageSwitcher buttonClassName="w-11 h-11 bg-white shadow-sm" />
        </div>

        {/* 아이콘 탭 — 에어비앤비 기본 상태 */}
        <div className={`flex items-center justify-center gap-[52px] transition-all duration-300 overflow-hidden ${isScrolled ? 'max-h-0 opacity-0 pt-0 pb-0' : 'max-h-[94px] opacity-100 pt-2 pb-[3px]'
          }`}>
          {/* 체험 탭 */}
          <button data-testid="home-tab-experience" onClick={() => setActiveTab('experience')} className="flex flex-col items-center relative">
            <div className="w-[68px] h-[68px] flex items-center justify-center relative mb-[-4px]">
              {/* These provider-hosted tab artworks intentionally stay raw to avoid changing existing fetch and optimization behavior. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://a0.muscache.com/im/pictures/airbnb-platform-assets/AirbnbPlatformAssets-search-bar-icons/original/e47ab655-027b-4679-b2e6-df1c99a5c33d.png?im_w=240"
                alt="체험" className={`w-full h-full object-contain transition-opacity duration-200 ${activeTab !== 'experience' ? 'opacity-40' : 'opacity-100'}`}
              />
              <div className="absolute top-[2px] right-[-6px] bg-[linear-gradient(180deg,#4B5563_0%,#1F2937_100%)] text-white text-[9px] font-semibold px-[6px] py-[2px] rounded-full z-10 border border-white/80 leading-none shadow-[0_2px_6px_rgba(15,23,42,0.35)]">
                NEW
              </div>
            </div>
            <span className={`text-[11px] leading-tight tracking-[0.02em] ${activeTab === 'experience' ? 'text-[#222222] font-semibold' : 'text-[#717171] font-normal'}`}>
              {t('cat_exp')}
            </span>
            {activeTab === 'experience' && <span className="absolute -bottom-[2px] left-1/2 -translate-x-1/2 w-[22px] h-[2px] bg-[#222222] rounded-full" />}
          </button>

          {/* 서비스 탭 */}
          <button data-testid="home-tab-service" onClick={() => setActiveTab('service')} className="flex flex-col items-center relative">
            <div className="w-[68px] h-[68px] flex items-center justify-center relative mb-[-4px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://a0.muscache.com/im/pictures/airbnb-platform-assets/AirbnbPlatformAssets-search-bar-icons/original/3d67e9a9-520a-49ee-b439-7b3a75ea814d.png?im_w=240"
                alt="서비스" className={`w-full h-full object-contain transition-opacity duration-200 ${activeTab !== 'service' ? 'opacity-40' : 'opacity-100'}`}
              />
              <div className="absolute top-[2px] right-[-6px] bg-[linear-gradient(180deg,#4B5563_0%,#1F2937_100%)] text-white text-[9px] font-semibold px-[6px] py-[2px] rounded-full z-10 border border-white/80 leading-none shadow-[0_2px_6px_rgba(15,23,42,0.35)]">
                NEW
              </div>
            </div>
            <span className={`text-[11px] leading-tight tracking-[0.02em] ${activeTab === 'service' ? 'text-[#222222] font-semibold' : 'text-[#717171] font-normal'}`}>
              {t('cat_service')}
            </span>
            {activeTab === 'service' && <span className="absolute -bottom-[2px] left-1/2 -translate-x-1/2 w-[22px] h-[2px] bg-[#222222] rounded-full" />}
          </button>
        </div>


        {/* 스크롤 시 텍스트 탭 — 에어비앤비 (전체 너비 분산) */}
        <div className={`flex items-center justify-center gap-12 transition-all duration-300 overflow-hidden ${isScrolled ? 'max-h-[34px] opacity-100 pb-1' : 'max-h-0 opacity-0'
          }`}>
          <button
            data-testid="home-tab-experience"
            onClick={() => setActiveTab('experience')}
            className={`relative py-[6px] text-[12px] tracking-[0.01em] transition-colors active:scale-[0.95] ${activeTab === 'experience' ? 'text-[#222222] font-extrabold' : 'text-[#7E7E7E] font-medium'
              }`}
          >
            {t('cat_exp')}
            {activeTab === 'experience' && <span className="absolute -bottom-[2px] left-1/2 -translate-x-1/2 w-[20px] h-[2px] bg-[#222222] rounded-full" />}
          </button>
          <button
            data-testid="home-tab-service"
            onClick={() => setActiveTab('service')}
            className={`relative py-[6px] text-[12px] tracking-[0.01em] transition-colors active:scale-[0.95] ${activeTab === 'service' ? 'text-[#222222] font-extrabold' : 'text-[#7E7E7E] font-medium'
              }`}
          >
            {t('cat_service')}
            {activeTab === 'service' && <span className="absolute -bottom-[2px] left-1/2 -translate-x-1/2 w-[20px] h-[2px] bg-[#222222] rounded-full" />}
          </button>
        </div>

      </div>

      {/* 📱 모바일 검색 모달 */}
      <MobileSearchModal
        isOpen={isMobileSearchOpen}
        onClose={() => setIsMobileSearchOpen(false)}
        locationInput={locationInput}
        setLocationInput={setLocationInput}
        dateRange={dateRange}
        setDateRange={setDateRange}
        selectedLanguage={selectedLanguage || 'all'}
        setSelectedLanguage={setSelectedLanguage || (() => { })}
      />

      {/* 🟢 2. 메인 확장 검색바 & 탭 영역 (데스크탑 전용) */}
      <div className="hidden md:block pt-24 pb-6 px-6 relative z-40 bg-white" ref={searchRef}>
        <div className="flex flex-col items-center relative">

          {/* 🟢 탭 버튼 (2.5배 아이콘 비율 & Medium 폰트 적용) - 데스크탑 전용 */}
          <div
            className={
              isScrolled
                ? 'flex gap-6 mb-4 transition-all duration-300 opacity-0 -translate-y-4 pointer-events-none h-0 mb-0 overflow-hidden'
                : 'flex gap-8 mb-4 transition-all duration-300 opacity-100 translate-y-0 h-auto'
            }
          >
            {/* 🎈 체험 탭 */}
            <button
              data-testid="home-tab-experience"
              onClick={() => setActiveTab('experience')}
              className={`group flex items-center gap-1 pl-1 pr-6 py-2 rounded-full transition-all duration-200 outline-none hover:bg-slate-50/80 ${activeTab === 'experience' ? 'opacity-100' : 'opacity-50 hover:opacity-100 grayscale-[30%] hover:grayscale-0'
                }`}
            >
              {/* 아이콘 영역 (54px - 텍스트 대비 약 2.5배 체감 크기) */}
              <div className="relative w-[117px] h-[117px] flex items-center justify-center shrink-0">
                {/* NEW 배지 (좌측 상단에 딱 맞게) */}
                <div className="absolute top-[6px] right-[-2px] bg-[linear-gradient(180deg,#4B5563_0%,#1F2937_100%)] text-white text-[11px] font-semibold px-[7px] py-[3px] rounded-full shadow-[0_2px_8px_rgba(15,23,42,0.35)] z-10 tracking-wide border border-white/80">
                  NEW
                </div>
                {/* 고화질 이미지 */}
                {/* These provider-hosted tab artworks intentionally stay raw to avoid changing existing fetch and optimization behavior. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://a0.muscache.com/im/pictures/airbnb-platform-assets/AirbnbPlatformAssets-search-bar-icons/original/e47ab655-027b-4679-b2e6-df1c99a5c33d.png?im_w=240"
                  alt="체험"
                  className="w-full h-full object-contain drop-shadow-sm transition-transform group-hover:scale-105"
                />
              </div>

              {/* 텍스트 (17px, Medium - 부드럽고 큼직하게) */}
              <span className={`text-[17px] whitespace-nowrap tracking-tight ${activeTab === 'experience' ? 'text-[#222222] font-medium' : 'text-[#717171] font-normal'
                }`}>
                {t('cat_exp')}
              </span>
            </button>

            {/* 🛎️ 서비스 탭 */}
            <button
              data-testid="home-tab-service"
              onClick={() => setActiveTab('service')}
              className={`group flex items-center gap-1 pl-1 pr-6 py-2 rounded-full transition-all duration-200 outline-none hover:bg-slate-50/80 ${activeTab === 'service' ? 'opacity-100' : 'opacity-50 hover:opacity-100 grayscale-[30%] hover:grayscale-0'
                }`}
            >
              {/* 아이콘 영역 (54px) */}
              <div className="relative w-[117px] h-[117px] flex items-center justify-center shrink-0">
                {/* NEW 배지 */}
                <div className="absolute top-[6px] right-[-2px] bg-[linear-gradient(180deg,#4B5563_0%,#1F2937_100%)] text-white text-[11px] font-semibold px-[7px] py-[3px] rounded-full shadow-[0_2px_8px_rgba(15,23,42,0.35)] z-10 tracking-wide border border-white/80">
                  NEW
                </div>
                {/* 고화질 이미지 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://a0.muscache.com/im/pictures/airbnb-platform-assets/AirbnbPlatformAssets-search-bar-icons/original/3d67e9a9-520a-49ee-b439-7b3a75ea814d.png?im_w=240"
                  alt="서비스"
                  className="w-full h-full object-contain drop-shadow-sm transition-transform group-hover:scale-105"
                />
              </div>

              {/* 텍스트 (17px, Medium) */}
              <span className={`text-[17px] whitespace-nowrap tracking-tight ${activeTab === 'service' ? 'text-[#222222] font-medium' : 'text-[#717171] font-normal'
                }`}>
                {t('cat_service')}
              </span>
            </button>
          </div>

          <MainSearchBar
            activeSearchField={activeSearchField}
            setActiveSearchField={setActiveSearchField}
            locationInput={locationInput}
            setLocationInput={setLocationInput}
            dateRange={dateRange}
            setDateRange={setDateRange}

            // ✅ [수정] '전체'를 'all'로 바꿔야 번역이 작동합니다!
            selectedLanguage={selectedLanguage || 'all'}
            setSelectedLanguage={setSelectedLanguage || (() => { })}
            onCategorySelect={setSelectedCategory}
            isVisible={!isScrolled}
            onSearch={onSearch}
          />
        </div>
      </div>

      {/* 🟢 3. 카테고리 필터 (데스크탑 전용) */}
      {activeTab === 'experience' && (
        <div className="hidden md:block bg-white pb-4 pt-2 border-b border-slate-100 relative z-30">
          <div className="max-w-[1760px] mx-auto px-6 md:px-12 flex justify-center">
            <div className="flex items-center gap-8 overflow-x-auto no-scrollbar pb-2 w-full justify-start md:justify-center">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  data-testid={`home-desktop-category-${cat.id}`}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={
                    selectedCategory === cat.id
                      ? 'flex flex-col items-center gap-2 min-w-fit pb-2 transition-all border-b-2 cursor-pointer group border-black opacity-100'
                      : 'flex flex-col items-center gap-2 min-w-fit pb-2 transition-all border-b-2 cursor-pointer group border-transparent opacity-60 hover:opacity-100 hover:border-slate-200'
                  }
                >
                  <span className="text-2xl transition-transform group-hover:scale-110 flex items-center justify-center h-[32px]">
                    {['seoul', 'busan', 'jeju'].includes(cat.id)
                      ? <HomeCategoryIcon id={cat.id as 'seoul' | 'busan' | 'jeju'} />
                      : cat.icon}
                  </span>
                  <span className={`text-xs font-bold whitespace-nowrap ${selectedCategory === cat.id ? 'text-black' : 'text-slate-600'}`}>
                    {t(cat.label)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
